import compareTwoStrings from 'string-similarity-js';

function getAnchor(text: string): string | null {
  if (!text) return null;
  // 匹配：第一节, 1.1, 一、, 第21条 等
  const match = text.match(/^(第[一二三四五六七八九十百\d]+[条章节]|[\d\.]+[\s、\.]|[一二三四五六七八九十]+[、\s])/);
  return match ? match[0].trim() : null;
}

/**
 * Aligns two sets of string blocks (paragraphs/lines) using a fuzzy similarity threshold.
 */
export function alignSemanticBlocks(textA: string, textB: string, threshold = 0.7): { alignedA: string, alignedB: string } {
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
      const similarity = compareTwoStrings(blockA, blockB);
      const anchorA = getAnchor(blockA);
      const anchorB = getAnchor(blockB);

      // 核心改进：锚点优先匹配
      // 如果两行都以相同的“第X节/条”开头，则强制对齐
      const isAnchorMatch = anchorA && anchorB && anchorA === anchorB;

      if (isAnchorMatch || similarity >= threshold) {
        // High similarity or Anchor Match - match them
        alignedA.push(blockA);
        alignedB.push(blockB);
        i++;
        j++;
      } else {
        // Low similarity - look ahead
        const lookAhead = 10; // 扩大搜索范围以应对目录长间距
        let foundMatch = false;

        for (let step = 1; step <= lookAhead; step++) {
          // Check blocksB
          if (j + step < blocksB.length) {
            const nextB = blocksB[j+step];
            const nextAnchorB = getAnchor(nextB);
            if ((anchorA && anchorA === nextAnchorB) || compareTwoStrings(blockA, nextB) >= threshold) {
              for (let k = 0; k < step; k++) {
                alignedA.push("");
                alignedB.push(blocksB[j + k]);
              }
              j += step;
              foundMatch = true;
              break;
            }
          }
          // Check blocksA
          if (i + step < blocksA.length) {
            const nextA = blocksA[i+step];
            const nextAnchorA = getAnchor(nextA);
            if ((anchorB && anchorB === nextAnchorA) || compareTwoStrings(nextA, blockB) >= threshold) {
              for (let k = 0; k < step; k++) {
                alignedA.push(blocksA[i + k]);
                alignedB.push("");
              }
              i += step;
              foundMatch = true;
              break;
            }
          }
        }

        if (!foundMatch) {
          // No match found in lookahead - treat as completely different lines
          // But check which one is "shorter" or more likely to be a standalone insert
          // For now, just step both if they exist, or one if not
          if (i < blocksA.length && j < blocksB.length) {
            alignedA.push(blocksA[i]);
            alignedB.push(blocksB[j]);
            i++;
            j++;
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
