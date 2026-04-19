import mammoth from 'mammoth';
import * as Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// pdfjs worker setup
// Using unpkg as a reliable source for the worker ESM module
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface ExtractedContent {
  text: string;
  tables: string[][][];
  rawHtml?: string;
  sourceType: 'docx' | 'pdf' | 'ocr';
}

/**
 * Extracts content from a .docx file using Mammoth.
 * Mammoth is open-source and handles tables well by converting them to HTML.
 */
export async function parseDocx(buffer: ArrayBuffer): Promise<ExtractedContent> {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer: buffer });
  
  // Basic table extraction from HTML
  const tables = extractTablesFromHtml(htmlResult.value);
  
  return {
    text: result.value,
    tables: tables,
    rawHtml: htmlResult.value,
    sourceType: 'docx'
  };
}

/**
 * Basic HTML table parser to extract structured data.
 */
function extractTablesFromHtml(html: string): string[][][] {
  const tables: string[][][] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tableElements = doc.querySelectorAll('table');

  tableElements.forEach(table => {
    const rows: string[][] = [];
    table.querySelectorAll('tr').forEach(tr => {
      const cells: string[] = [];
      tr.querySelectorAll('td, th').forEach(td => {
        cells.push(td.textContent?.trim() || '');
      });
      if (cells.length > 0) rows.push(cells);
    });
    if (rows.length > 0) tables.push(rows);
  });

  return tables;
}

/**
 * Extracts text from a PDF without using external APIs.
 * This is the 'Private' open-source approach.
 */
export async function parsePdfOpenSource(buffer: ArrayBuffer): Promise<ExtractedContent> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => item.str);
    fullText += strings.join(' ') + '\n';
  }

  return { 
    text: fullText, 
    tables: [], // Robust table extraction from PDF requires complex heuristics 
    sourceType: 'pdf' 
  };
}

/**
 * OCR extraction for scanned PDFs using Tesseract.js.
 * Renders each PDF page to a canvas then runs OCR.
 */
export async function parsePdfOcr(
  buffer: ArrayBuffer, 
  onProgress?: (progress: { page: number, total: number }) => void
): Promise<ExtractedContent> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let fullText = '';
  
  const worker = await Tesseract.createWorker('chi_sim+eng');

  for (let i = 1; i <= pdf.numPages; i++) {
    if (onProgress) onProgress({ page: i, total: pdf.numPages });
    
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.5 }); // Even higher scale for contracts
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) continue;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas
    }).promise;

    const { data: { text } } = await worker.recognize(canvas);
    fullText += text + '\n';
  }

  await worker.terminate();
  return { text: fullText, tables: [], sourceType: 'ocr' };
}

/**
 * Basic OCR for Image files (PNG/JPG)
 */
export async function parseImageOcr(file: File): Promise<ExtractedContent> {
  const worker = await Tesseract.createWorker('eng+chi_sim');
  const { data: { text } } = await worker.recognize(file);
  await worker.terminate();
  return { text, tables: [], sourceType: 'ocr' };
}

/**
 * Normalizes content for comparison:
 * 1. Removes spaces between Chinese characters (common OCR/PDF layout issue)
 * 2. Collapses multiple spaces and newlines
 * 3. Standardizes punctuation spacing
 */
export function normalizeForDiff(text: string): string {
  if (!text) return '';
  
  return text
    // 1. 统一特殊空白字符为普通空格
    .replace(/[\u00A0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/g, ' ')
    // 2. 清除目录中的点号串、虚线串（目录引导点）
    .replace(/\.{2,}/g, '')
    .replace(/·{2,}/g, '')
    .replace(/_{2,}/g, '')
    // 3. 处理中文字符间的多余空格
    .replace(/([\u4e00-\u9fa5])\s+(?=[\u4e00-\u9fa5])/g, '$1')
    .replace(/([\u4e00-\u9fa5])\s+([，。！？；：、‘’“”【】（）])/g, '$1$2')
    .replace(/([，。！？；：、‘’“”【】（）])\s+([\u4e00-\u9fa5])/g, '$1$2')
    // 4. 按行拆分，深度清洗
    .split(/[\r\n\f]+/) // 包含处理换页符 \f
    .map(line => line.trim())
    .filter(line => {
      // 过滤掉仅由符号或页码组成的干扰行
      if (line.length === 0) return false;
      // 过滤掉纯数字行（通常是页码）
      if (/^\d+$/.test(line)) return false;
      // 过滤掉只有简单符号的行
      if (/^[\.\-·_]+$/.test(line)) return false;
      return true;
    })
    // 5. 压缩行内连续空格并重新合并
    .map(line => line.replace(/\s{2,}/g, ' '))
    .join('\n');
}
