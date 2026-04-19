import React, { useState } from 'react';
import { 
  FileSearch,
  Settings,
  ShieldCheck,
  Layers,
  Zap,
  Loader2,
  AlertCircle,
  Database
} from 'lucide-react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { FileUploader } from './components/FileUploader';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { parseDocx, parsePdfOpenSource, parsePdfOcr, parseImageOcr, normalizeForDiff } from './lib/parser';

export default function App() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [contentA, setContentA] = useState<string>('');
  const [contentB, setContentB] = useState<string>('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const formatSize = (bytes: number) => (bytes / 1024 / 1024).toFixed(2) + ' MB';

  const extractContent = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const buffer = await file.arrayBuffer();
    
    if (extension === 'docx') {
      const result = await parseDocx(buffer);
      return normalizeForDiff(result.text);
    } else if (extension === 'pdf') {
      // Use a slice to prevent detachment if we need to reuse the buffer for OCR
      const result = await parsePdfOpenSource(buffer.slice(0));
      let text = normalizeForDiff(result.text);
      
      // Auto-fallback to OCR if it's a scanned PDF (no text found)
      if (text.length < 10) {
        const ocrResult = await parsePdfOcr(buffer.slice(0), (p) => {
          setStatus(`OCR Scanning: Page ${p.page} of ${p.total}...`);
          setProgress(15 + Math.floor((p.page / p.total) * 35));
        });
        text = normalizeForDiff(ocrResult.text);
      }
      return text;
    } else if (['png', 'jpg', 'jpeg'].includes(extension || '')) {
      const result = await parseImageOcr(file);
      return normalizeForDiff(result.text);
    }
    
    return '';
  };

  const handleCompare = async () => {
    if (!fileA || !fileB) return;
    setIsProcessing(true);
    setError(null);
    setProgress(5);
    setStatus('Initializing secure environment...');

    try {
      setProgress(15);
      setStatus(`Parsing PDF: ${fileA.name}...`);
      const textA = await extractContent(fileA);
      
      setProgress(50);
      setStatus(`Parsing Word: ${fileB.name}...`);
      const textB = await extractContent(fileB);

      if (!textA && !textB) {
        throw new Error("Could not extract any meaningful text from the provided files.");
      }

      setProgress(85);
      setStatus('Generating analysis...');
      setContentA(textA);
      setContentB(textB);
      
      setProgress(100);
      setStatus('Success: Report generated');
      
      // Auto-scroll to results
      setTimeout(() => {
        document.getElementById('analysis-report')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);

    } catch (err: any) {
      setError(err.message || 'Comparison failed.');
      console.error(err);
      setProgress(0);
    } finally {
      setIsProcessing(false);
      // Keep progress visible for a bit longer
      setTimeout(() => setProgress(0), 5000);
    }
  };

  return (
    <div className={cn(
      "min-h-screen font-sans",
      "bg-[#E4E3E0] text-[#141414]"
    )}>
      {/* Grid Pattern Background */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />

      {/* Header */}
      <header className="border-b border-[#141414] px-8 py-4 flex items-center justify-between sticky top-0 bg-[#E4E3E0] z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 border border-[#141414] flex items-center justify-center">
            <FileSearch size={20} />
          </div>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-tighter">合同比对</h1>
            <p className="text-[10px] font-mono opacity-50 italic">本地安全解析模式已启动</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 border border-[#141414] bg-white/50 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
            <ShieldCheck size={12} />
            私有节点
          </div>
          <button className="p-2 border border-[#141414] hover:bg-white transition-colors">
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Progress Bar (Global) */}
      <AnimatePresence>
        {progress > 0 && (
          <motion.div 
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            exit={{ scaleY: 0 }}
            className="h-1 bg-[#141414] w-full sticky top-[73px] z-40 origin-top"
          >
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="px-8 py-8 space-y-8 relative">
        {/* Input Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#141414] border border-[#141414] shadow-xl">
          <div className="bg-[#f0efed] p-8 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-serif italic text-xs opacity-50 uppercase tracking-widest">合同原件 [PDF 格式]</span>
              {fileA && <span className="font-mono text-[10px] opacity-70">{formatSize(fileA.size)}</span>}
            </div>
            <FileUploader 
              label="标准 PDF 文件" 
              accept=".pdf" 
              file={fileA} 
              onFileSelect={setFileA} 
              className="bg-white/50 border-blue-200"
            />
          </div>
          <div className="bg-[#f0efed] p-8 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-serif italic text-xs opacity-50 uppercase tracking-widest">修订版本 [Word 格式]</span>
              {fileB && <span className="font-mono text-[10px] opacity-70">{formatSize(fileB.size)}</span>}
            </div>
            <FileUploader 
              label="Word 文件" 
              accept=".docx" 
              file={fileB} 
              onFileSelect={setFileB} 
              className="bg-white/50 border-emerald-200"
            />
          </div>
        </section>

        {/* Action Button */}
        <div className="flex items-center justify-center translate-y-[-50%] absolute left-0 right-0 z-10">
          <button
            onClick={handleCompare}
            disabled={!fileA || !fileB || isProcessing}
            className={cn(
              "px-10 py-4 bg-[#141414] text-white shadow-2xl transition-all border border-white",
              "flex items-center gap-4 font-bold uppercase text-xs tracking-widest",
              "hover:bg-[#2a2a2a] disabled:opacity-50 active:scale-95 group"
            )}
          >
            {isProcessing ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Zap size={20} className="text-yellow-400 group-hover:scale-125 transition-transform" />
            )}
            {isProcessing ? "正在处理中..." : "开始执行合同比对"}
          </button>
        </div>

        {/* Dashboard Panels */}
        <div className="pt-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Stats */}
            <aside className="lg:col-span-1 space-y-4">
              <div className="border border-[#141414] p-4 bg-white/30 space-y-4">
                <h3 className="font-serif italic text-xs border-b border-[#141414] pb-2 uppercase tracking-wide">系统洞察 / SYSTEM INSIGHTS</h3>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span>状态:</span>
                      <span className={cn("font-bold", isProcessing ? "text-blue-600" : (contentA ? "text-emerald-600" : "text-gray-600"))}>
                        {isProcessing ? "正在处理" : (contentA ? "报告已就绪" : "待命中")}
                      </span>
                    </div>
                    <div className="text-[9px] font-mono opacity-50 leading-tight uppercase">
                      {status || "IDLE"}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span>转换进度:</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1 bg-[#141414]/10 rounded-full overflow-hidden">
                      <motion.div 
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-[#141414]"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[9px] font-mono text-emerald-800 bg-emerald-500/10 p-2 border border-emerald-500/20">
                      <ShieldCheck size={12} /> 私有节点已验证
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-mono text-blue-800 bg-blue-500/10 p-2 border border-blue-500/20">
                      <Database size={12} /> 本地存储运行中
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  className="bg-red-50 border border-red-500 p-4 text-red-600 text-xs font-mono"
                >
                  <div className="flex items-center gap-2 font-bold uppercase mb-1">
                    <AlertCircle size={14} /> SYSTEM_HALTED
                  </div>
                  {error}
                </motion.div>
              )}
            </aside>

            {/* Main Visualizer */}
            <div className="lg:col-span-3">
              <AnimatePresence mode="wait">
                {contentA && contentB ? (
                  <motion.div 
                    key="results"
                    id="analysis-report"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-[#141414] bg-white shadow-2xl overflow-hidden"
                  >
                    <div className="bg-[#141414] text-white px-6 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers size={14} className="text-emerald-400" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-100">逐字比对报告 / WORD-BY-WORD REPORT</span>
                      </div>
                      <div className="flex gap-4 text-[9px] font-mono uppercase opacity-70">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500/50 rounded-full" /> 删除文本</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500/50 rounded-full" /> 新增文本</span>
                      </div>
                    </div>

                    <div className="diff-container overflow-x-auto">
                      <ReactDiffViewer
                        oldValue={contentA}
                        newValue={contentB}
                        splitView={true}
                        compareMethod={DiffMethod.WORDS}
                        styles={{
                          variables: {
                            light: {
                              diffViewerBackground: '#fff',
                              diffViewerColor: '#141414',
                              addedBackground: '#ecfdf5',
                              addedColor: '#047857',
                              removedBackground: '#fef2f2',
                              removedColor: '#dc2626',
                              wordAddedBackground: '#34d39966',
                              wordRemovedBackground: '#f8717166',
                            }
                          },
                          contentText: {
                            fontSize: '13px',
                            lineHeight: '22px',
                            fontFamily: '"JetBrains Mono", monospace'
                          },
                          lineNumber: {
                            fontSize: '10px',
                            color: '#999',
                            fontFamily: '"JetBrains Mono", monospace'
                          }
                        }}
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="empty"
                    className="h-[500px] border-2 border-dashed border-[#141414]/20 flex flex-col items-center justify-center text-[#141414]/30 space-y-4"
                  >
                    <div className="w-16 h-16 border border-[#141414]/20 flex items-center justify-center opacity-30">
                      <FileSearch size={32} />
                    </div>
                    <div className="text-center">
                      <p className="font-serif italic text-sm">等待文件同步</p>
                      <p className="text-[10px] font-mono uppercase tracking-widest mt-1 italic">请上传原件和修订版文件以开始比对</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      <footer className="px-8 py-12 border-t border-[#141414] bg-white/50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-[#141414] text-white flex items-center justify-center text-[10px] font-bold italic">C</div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-tight">合同验证器 v1.1 / Contract_Verifier</span>
          </div>
          <div className="flex gap-12 text-[9px] font-mono uppercase tracking-widest font-bold opacity-40">
            <span>逐字节分析</span>
            <span>文档结构提取</span>
            <span>光学识别引擎</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-700" />
            <span className="text-[10px] font-mono font-bold uppercase">零知识本地解析</span>
          </div>
        </div>
      </footer>

      <style>{`
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; }
        ::-webkit-scrollbar-thumb { background: #141414; }
        ::-webkit-scrollbar-thumb:hover { background: #333; }
        .diff-container .css-1ax0oat-diff-viewer { border-radius: 0 !important; }
      `}</style>
    </div>
  );
}
