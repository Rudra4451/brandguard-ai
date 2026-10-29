import type { Node as PMNode } from '@tiptap/pm/model';
import { parseSentences } from './sentence-parser';
import type { Finding } from './types';

export interface ResolvedSpan {
  from: number;
  to: number;
  sentenceId: string;
}

/**
 * Resolves a finding's sentence-relative offsets to global ProseMirror document positions.
 *
 * Algorithm:
 * 1. Collect all text from ProseMirror document with text node position mapping.
 * 2. Parse sentences on the extracted document text using parseSentences().
 * 3. Find the sentence matching finding.sentenceId. If absent, return null (orphaned).
 * 4. Translate finding's sentence-relative [startOffset, endOffset] to global UTF-16 character offsets.
 * 5. Map global UTF-16 character offsets to ProseMirror node positions (accounting for paragraph boundaries).
 */
export function resolveFindingAnchor(
  doc: PMNode,
  finding: Finding
): ResolvedSpan | null {
  // Step 1: Extract flat text and build charOffset -> pmPos lookup
  const textChars: string[] = [];
  const charToPos: number[] = [];

  let isFirstBlock = true;
  doc.descendants((node, pos) => {
    if (node.isBlock && node.isTextblock) {
      if (!isFirstBlock) {
        textChars.push('\n');
        charToPos.push(pos);
      }
      isFirstBlock = false;
    } else if (node.isText && node.text) {
      const text = node.text;
      for (let i = 0; i < text.length; i++) {
        textChars.push(text[i]);
        charToPos.push(pos + i);
      }
    }
  });

  const fullText = textChars.join('');

  // Step 2: Parse sentences on the document text
  const sentences = parseSentences(fullText);
  const targetSentence = sentences.find((s) => s.id === finding.sentenceId);

  // Step 3: If target sentence doesn't exist, finding is orphaned
  if (!targetSentence) {
    return null;
  }

  // Step 4: Compute global character offsets in fullText
  const globalCharStart = targetSentence.globalStart + finding.startOffset;
  const globalCharEnd = targetSentence.globalStart + finding.endOffset;

  if (globalCharStart < 0 || globalCharStart > fullText.length) {
    return null;
  }

  // Handle zero-length findings (e.g., missing disclaimer anchored at end of sentence)
  if (finding.startOffset === finding.endOffset) {
    const anchorChar = Math.min(globalCharStart, fullText.length - 1);
    const pmPos = charToPos[anchorChar] ?? doc.content.size;
    return {
      from: pmPos,
      to: pmPos,
      sentenceId: targetSentence.id,
    };
  }

  const boundedCharEnd = Math.min(globalCharEnd, fullText.length);
  const fromPmPos = charToPos[globalCharStart];
  // charToPos[boundedCharEnd - 1] is the start of the last character, so its end in PM is + 1
  const toPmPos = (charToPos[boundedCharEnd - 1] ?? fromPmPos) + 1;

  if (fromPmPos === undefined || toPmPos === undefined || fromPmPos > toPmPos) {
    return null;
  }

  return {
    from: fromPmPos,
    to: toPmPos,
    sentenceId: targetSentence.id,
  };
}
