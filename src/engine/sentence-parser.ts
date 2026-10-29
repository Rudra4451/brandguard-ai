export interface ParsedSentence {
  id: string; // e.g., 'S1', 'S2'
  index: number; // 0-based index
  text: string; // Trimmed sentence text
  rawText: string; // Untrimmed text in the source
  globalStart: number; // UTF-16 start offset in draft
  globalEnd: number; // UTF-16 end offset in draft
}

const COMMON_ABBREVIATIONS = new Set([
  'dr', 'mr', 'mrs', 'ms', 'prof', 'inc', 'ltd', 'corp', 'co', 'dept', 'vs', 'etc', 'e.g', 'i.e', 'approx', 'est'
]);

/**
 * Splits text into sentences with stable IDs (S1, S2, ...) while respecting:
 * - Sentence terminators: '.', '!', '?', and full-width '。', '！', '？'.
 * - Preserving decimals in numbers (e.g., 14.5).
 * - Preserving common abbreviations (e.g., Dr., Inc.).
 * - Preserving ellipses (...).
 * - Blank-line-separated paragraphs.
 */
export function parseSentences(draft: string): ParsedSentence[] {
  if (!draft || draft.trim().length === 0) {
    return [];
  }

  const sentences: ParsedSentence[] = [];
  const len = draft.length;

  let currentStart = 0;
  let i = 0;

  const isTerminator = (ch: string) =>
    ch === '.' || ch === '!' || ch === '?' || ch === '。' || ch === '！' || ch === '？';

  const isFullWidthTerminator = (ch: string) =>
    ch === '。' || ch === '！' || ch === '？';

  while (i < len) {
    // Check for blank line / paragraph break: two or more consecutive newlines
    if (draft[i] === '\n') {
      let newlineCount = 1;
      let j = i + 1;
      while (j < len && (draft[j] === '\n' || draft[j] === '\r' || draft[j] === ' ' || draft[j] === '\t')) {
        if (draft[j] === '\n') {
          newlineCount++;
        }
        j++;
      }

      if (newlineCount >= 2) {
        // Blank-line separated paragraph boundary
        const rawText = draft.slice(currentStart, i);
        if (rawText.trim().length > 0) {
          sentences.push(buildSentence(sentences.length + 1, rawText, currentStart, i));
        }
        currentStart = j;
        i = j;
        continue;
      }
    }

    const char = draft[i];

    if (isTerminator(char)) {
      // 1. Check for ellipsis: multiple dots like "..."
      if (char === '.' && (draft[i + 1] === '.' || (i > 0 && draft[i - 1] === '.'))) {
        i++;
        continue;
      }

      // 2. Check for number decimal: e.g. "14.5"
      if (
        char === '.' &&
        i > 0 &&
        i + 1 < len &&
        /\d/.test(draft[i - 1]) &&
        /\d/.test(draft[i + 1])
      ) {
        i++;
        continue;
      }

      // 3. Check for abbreviation: e.g. "Dr.", "Inc."
      if (char === '.') {
        // Scan backwards to get word before the period
        let wStart = i - 1;
        while (wStart >= currentStart && /[a-zA-Z]/.test(draft[wStart])) {
          wStart--;
        }
        const precedingWord = draft.slice(wStart + 1, i).toLowerCase();
        if (COMMON_ABBREVIATIONS.has(precedingWord)) {
          i++;
          continue;
        }
      }

      // 4. For full-width terminators, or standard terminators followed by whitespace, quotes, or EOF
      const isEnd = i + 1 >= len;
      const followedBySpaceOrNewline = !isEnd && (/\s/.test(draft[i + 1]) || draft[i + 1] === '"' || draft[i + 1] === "'");

      if (isFullWidthTerminator(char) || isEnd || followedBySpaceOrNewline) {
        // Include any immediate trailing closing quotes or brackets
        let endIdx = i + 1;
        while (endIdx < len && (draft[endIdx] === '"' || draft[endIdx] === "'" || draft[endIdx] === ')' || draft[endIdx] === '”')) {
          endIdx++;
        }

        const rawText = draft.slice(currentStart, endIdx);
        if (rawText.trim().length > 0) {
          sentences.push(buildSentence(sentences.length + 1, rawText, currentStart, endIdx));
        }

        // Advance past trailing whitespace
        while (endIdx < len && /\s/.test(draft[endIdx])) {
          endIdx++;
        }
        currentStart = endIdx;
        i = endIdx;
        continue;
      }
    }

    i++;
  }

  // Any remaining text in buffer
  if (currentStart < len) {
    const rawText = draft.slice(currentStart, len);
    if (rawText.trim().length > 0) {
      sentences.push(buildSentence(sentences.length + 1, rawText, currentStart, len));
    }
  }

  return sentences;
}

function buildSentence(index: number, rawText: string, globalStart: number, globalEnd: number): ParsedSentence {
  const leadingWhitespaceMatch = rawText.match(/^\s*/);
  const leadingOffset = leadingWhitespaceMatch ? leadingWhitespaceMatch[0].length : 0;
  const trailingWhitespaceMatch = rawText.match(/\s*$/);
  const trailingOffset = trailingWhitespaceMatch ? trailingWhitespaceMatch[0].length : 0;

  return {
    id: `S${index}`,
    index: index - 1,
    text: rawText.trim(),
    rawText,
    globalStart: globalStart + leadingOffset,
    globalEnd: globalEnd - trailingOffset,
  };
}
