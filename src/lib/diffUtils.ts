import compareTwoStrings from 'string-similarity-js';

/**
 * 清洁文本用于相似度比对：移除所有非语义噪点
 */
function cleanForComparison(text: string): string {
  if (!text) return "";
  // 移除所有标点、空格、特殊符号，只保留中文字符、字母和数字
  return text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
}

function getAnchor(text: string): string | null {
  if (!text) return null;
  const match = text.match(/^(第[一二三四五六七八九十百\d]+[条章节]|[\d\.]+[\s、\.]|[一二三四五六七八九十]+[、\s])/);
  return match ? match[0].trim() : null;
}

/**
 * 语义级对齐算法：支持模糊对齐和全局锚点锁定
 */
export function alignSemanticBlocks(textA: string, textB: string, threshold = 0.8): { alignedA: string, alignedB: string } {
  const blocksA = textA.split('\n');
  const blocksB = textB.split('\n');
  
  const alignedA: string[] = [];
  const alignedB: string[] = [];
  
  let i = 0;
  let j = 0;

  while (i < blocksA.length || j < blocksB.length) {
    const blockA = blocksA[i] || "";
    const blockB = blocksB[j] || "";

    if (i < blocksA.length && j < blocksB.length) {
      // 提取核心语义（去除 OCR 干扰）
      const cleanA = cleanForComparison(blockA);
      const cleanB = cleanForComparison(blockB);
      
      const similarity = compareTwoStrings(cleanA, cleanB);
      const anchorA = getAnchor(blockA);
      const anchorB = getAnchor(blockB);

      const isAnchorMatch = anchorA && anchorB && anchorA === anchorB;
      // 用户要求：相似度超过 80% 强制对齐
      const isStrongMatch = similarity >= threshold;

      if (isAnchorMatch || isStrongMatch) {
        alignedA.push(blockA);
        alignedB.push(blockB);
        i++;
        j++;
      } else {
        // 激进搜索：在更广范围内寻找最优匹配点 (Deep Look-ahead)
        const maxLookAhead = 30; // 显著增加搜索深度以应对目录或长合同的增减
        let bestMatch = -1;
        let bestSource = "";

        for (let step = 1; step <= maxLookAhead; step++) {
          // 在 B 中找 A 的潜在匹配
          if (j + step < blocksB.length) {
            const nextB = cleanForComparison(blocksB[j + step]);
            if (compareTwoStrings(cleanA, nextB) >= threshold || (anchorA && anchorA === getAnchor(blocksB[j + step]))) {
              bestMatch = step;
              bestSource = "B";
              break;
            }
          }
          // 在 A 中找 B 的潜在匹配
          if (i + step < blocksA.length) {
            const nextA = cleanForComparison(blocksA[i + step]);
            if (compareTwoStrings(nextA, cleanB) >= threshold || (anchorB && anchorB === getAnchor(blocksA[i + step]))) {
              bestMatch = step;
              bestSource = "A";
              break;
            }
          }
        }

        if (bestMatch !== -1) {
          if (bestSource === "B") {
            for (let k = 0; k < bestMatch; k++) {
              alignedA.push("");
              alignedB.push(blocksB[j + k]);
            }
            j += bestMatch;
          } else {
            for (let k = 0; k < bestMatch; k++) {
              alignedA.push(blocksA[i + k]);
              alignedB.push("");
            }
            i += bestMatch;
          }
        } else {
          // 无匹配情况下的兜底策略
          // 如果一行看起来像是一个孤儿行，则单独推进
          alignedA.push(blockA);
          alignedB.push(blockB);
          i++;
          j++;
        }
      }
    } else if (i < blocksA.length) {
      alignedA.push(blocksA[i]);
      alignedB.push("");
      i++;
    } else {
      alignedA.push("");
      alignedB.push(blocksB[j]);
      j++;
    }
  }

  return {
    alignedA: alignedA.join('\n'),
    alignedB: alignedB.join('\n')
  };
}
