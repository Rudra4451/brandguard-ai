import type { Finding, FindingSeverity, Rule, Fact } from './types';
import { parseSentences, type ParsedSentence } from './sentence-parser';


function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pure deterministic governance inspection function.
 * Evaluates draft against rules and channel constraints, detecting:
 * - Banned phrases and discouraged terms (with word-boundary and case sensitivity)
 * - Required disclaimers across the full draft (anchored on final sentence if missing)
 * - Trademark format regex compliance
 * - Channel character limits
 * - Claim candidate triggers (percentages, bare numbers > 100 before nouns, guarantees, superlatives)
 *
 * Tone guidance rules produce ZERO deterministic findings.
 * Facts are NOT evidence in the deterministic engine.
 */
export function inspect(
  draft: string,
  rules: Rule[],
  _facts: Fact[],
  channel: string
): Finding[] {
  if (!draft || draft.trim().length === 0) {
    return [];
  }

  const sentences = parseSentences(draft);
  if (sentences.length === 0) {
    return [];
  }

  const findings: Finding[] = [];
  const enabledRules = rules.filter((r) => r.enabled);

  // 1. Channel length check
  const channelLimitRule = enabledRules.find(
    (r) => r.category === 'CHANNEL_LIMIT' && r.matchingStrategy.type === 'channelLimit' && r.matchingStrategy.channel.toLowerCase() === channel.toLowerCase()
  );

  if (channelLimitRule && channelLimitRule.matchingStrategy.type === 'channelLimit') {
    const maxChars = channelLimitRule.matchingStrategy.maxChars;
    if (draft.length > maxChars) {
      // Find the sentence containing the first character over the limit
      const lastSentence = sentences[sentences.length - 1];
      let targetSentence = lastSentence;
      let startOffsetInSentence = 0;

      for (const s of sentences) {
        if (s.globalStart <= maxChars && s.globalEnd >= maxChars) {
          targetSentence = s;
          startOffsetInSentence = maxChars - s.globalStart;
          break;
        }
      }

      if (startOffsetInSentence >= targetSentence.text.length) {
        startOffsetInSentence = Math.max(0, targetSentence.text.length - 1);
      }

      const excessChars = draft.length - maxChars;
      findings.push({
        id: `${channelLimitRule.id}-${targetSentence.id}-${startOffsetInSentence}`,
        ruleId: channelLimitRule.id,
        category: 'CHANNEL_LIMIT',
        severity: 'VIOLATION',
        sentenceId: targetSentence.id,
        startOffset: startOffsetInSentence,
        endOffset: targetSentence.text.length,
        flaggedText: targetSentence.text.slice(startOffsetInSentence),
        explanation: `Draft length of ${draft.length} exceeds ${channel} limit of ${maxChars} chars by ${excessChars} characters.`,
        evidence: {
          ruleId: channelLimitRule.id,
          ruleDescription: channelLimitRule.description,
        },
      });
    }
  }

  // 2. Required disclaimers check (across entire draft)
  const requiredDisclaimerRules = enabledRules.filter(
    (r) => r.category === 'REQUIRED_DISCLAIMER' && r.matchingStrategy.type === 'requiredDisclosure'
  );

  for (const rule of requiredDisclaimerRules) {
    if (rule.matchingStrategy.type !== 'requiredDisclosure') continue;
    const { text, caseSensitive } = rule.matchingStrategy;
    const draftToCheck = caseSensitive ? draft : draft.toLowerCase();
    const textToCheck = caseSensitive ? text : text.toLowerCase();

    if (!draftToCheck.includes(textToCheck)) {
      // Anchor on the last sentence
      const lastSentence = sentences[sentences.length - 1];
      const startOffset = lastSentence.text.length;
      const endOffset = lastSentence.text.length;

      findings.push({
        id: `${rule.id}-${lastSentence.id}-${startOffset}`,
        ruleId: rule.id,
        category: 'REQUIRED_DISCLAIMER',
        severity: 'VIOLATION',
        sentenceId: lastSentence.id,
        startOffset,
        endOffset,
        flaggedText: '',
        explanation: `Missing required disclaimer: "${text}". Full draft must contain this mandatory disclosure.`,
        evidence: {
          ruleId: rule.id,
          ruleDescription: rule.description,
        },
      });
    }
  }

  // 3. Sentence-level checks (Banned phrases, Discouraged terms, Trademarks, Claim Candidates)
  for (const sentence of sentences) {
    const sText = sentence.text;

    for (const rule of enabledRules) {
      // Tone guidance produces zero deterministic findings
      if (rule.category === 'TONE_GUIDANCE') {
        continue;
      }

      // Phrase matching for BANNED_PHRASE and DISCOURAGED_TERM
      if (
        (rule.category === 'BANNED_PHRASE' || rule.category === 'DISCOURAGED_TERM') &&
        rule.matchingStrategy.type === 'phrase'
      ) {
        const { phrase, caseSensitive, wordBoundary } = rule.matchingStrategy;
        const flags = caseSensitive ? 'g' : 'gi';
        const escaped = escapeRegex(phrase);
        const patternStr = wordBoundary ? `\\b${escaped}\\b` : escaped;
        const regex = new RegExp(patternStr, flags);

        let match: RegExpExecArray | null;
        while ((match = regex.exec(sText)) !== null) {
          const matchStart = match.index;
          const matchEnd = matchStart + match[0].length;
          const verbatimText = sText.slice(matchStart, matchEnd);

          findings.push({
            id: `${rule.id}-${sentence.id}-${matchStart}`,
            ruleId: rule.id,
            category: rule.category,
            severity: rule.severity,
            sentenceId: sentence.id,
            startOffset: matchStart,
            endOffset: matchEnd,
            flaggedText: verbatimText,
            explanation:
              rule.explanation ||
              `Found ${rule.category.toLowerCase().replace('_', ' ')} "${verbatimText}" which violates ${rule.id}.`,
            suggestedCorrection:
              rule.id === 'RULE-01' || verbatimText.toLowerCase() === 'miracle'
                ? 'clinically tested'
                : undefined,
            evidence: {
              ruleId: rule.id,
              ruleDescription: rule.description,
            },
          });
        }
      }

      // Regex matching for TRADEMARK_FORMAT
      if (rule.category === 'TRADEMARK_FORMAT' && rule.matchingStrategy.type === 'regex') {
        const { pattern, flags, expectedFormat } = rule.matchingStrategy;
        // Ensure global flag so we capture all matches in sentence
        const regexFlags = flags.includes('g') ? flags : flags + 'g';
        const regex = new RegExp(pattern, regexFlags);

        let match: RegExpExecArray | null;
        while ((match = regex.exec(sText)) !== null) {
          const matchStart = match.index;
          const matchEnd = matchStart + match[0].length;
          const matchedText = sText.slice(matchStart, matchEnd);

          // Verify if matched text equals expected format
          if (matchedText !== expectedFormat) {
            findings.push({
              id: `${rule.id}-${sentence.id}-${matchStart}`,
              ruleId: rule.id,
              category: 'TRADEMARK_FORMAT',
              severity: 'VIOLATION',
              sentenceId: sentence.id,
              startOffset: matchStart,
              endOffset: matchEnd,
              flaggedText: matchedText,
              explanation: `Trademark format error: found "${matchedText}", expected "${expectedFormat}".`,
              suggestedCorrection: undefined,
              evidence: {
                ruleId: rule.id,
                ruleDescription: rule.description,
              },
            });
          }
        }
      }
    }

    // 4. Claim Candidate Detector for the sentence
    detectClaimCandidates(sentence, findings);

    // 5. Accessibility Asset Audit (WCAG Contrast & Alt-Text)
    detectAccessibilityIssues(sentence, findings);
  }

  // 6. Deduplication and sorting
  return deduplicateAndSortFindings(findings);
}

/**
 * Computes WCAG 2.1 relative luminance and contrast ratio between two hex colors.
 * Throws TypeError or Error if either hex color string is invalid.
 */
export function checkWcagContrast(
  fg: string,
  bg: string
): { ratio: number; passes: boolean } {
  const parseHex = (hex: string): [number, number, number] => {
    const clean = hex.trim().replace(/^#/, '');
    if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(clean)) {
      throw new Error(`Invalid hex color format: "${hex}"`);
    }
    const full =
      clean.length === 3
        ? clean
            .split('')
            .map((c) => c + c)
            .join('')
        : clean;
    const num = parseInt(full, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };

  const getLuminance = (rgb: [number, number, number]): number => {
    const [r, g, b] = rgb.map((val) => {
      const s = val / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const [r1, g1, b1] = parseHex(fg);
  const [r2, g2, b2] = parseHex(bg);

  const l1 = getLuminance([r1, g1, b1]);
  const l2 = getLuminance([r2, g2, b2]);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  const rawRatio = (lighter + 0.05) / (darker + 0.05);
  const ratio = Math.round(rawRatio * 100) / 100;
  const passes = ratio >= 4.5;

  return { ratio, passes };
}

/**
 * Detects accessibility violations in draft text assets (missing image alt text and WCAG contrast failures).
 */
function detectAccessibilityIssues(sentence: ParsedSentence, accumulator: Finding[]): void {
  const sText = sentence.text;

  // 1. Missing or empty image alt text
  // Matches alt="" or alt='' or alt: "" or markdown ![]() without alt
  const altRegex =
    /(?:alt\s*[:=]\s*["']\s*["']|!\[\s*\]|\balt=["']\s*["'])/gi;

  let altMatch: RegExpExecArray | null;
  while ((altMatch = altRegex.exec(sText)) !== null) {
    const start = altMatch.index;
    const end = start + altMatch[0].length;
    const matchedStr = sText.slice(start, end);

    accumulator.push({
      id: `WCAG_ALT_TEXT-${sentence.id}-${start}`,
      ruleId: 'WCAG_ALT_TEXT',
      category: 'A11Y_ASSET_AUDIT' as unknown as Finding['category'],
      severity: 'VIOLATION',
      sentenceId: sentence.id,
      startOffset: start,
      endOffset: end,
      flaggedText: matchedStr,
      explanation: 'Image asset missing required non-empty alt text (WCAG 1.1.1 Non-text Content).',
      evidence: {
        ruleId: 'WCAG_ALT_TEXT',
        ruleDescription: 'All non-decorative visual assets must specify informative alternative text.',
      },
    });
  }

  // 2. WCAG color contrast violations
  // Matches pairs of fg and bg hex colors in tags, metadata, or styles
  const contrastPairRegex =
    /(?:fg|color)\s*[:=]\s*["']?(#[0-9a-zA-Z]{3,8})["']?[^>\]]*?(?:bg|background)\s*[:=]\s*["']?(#[0-9a-zA-Z]{3,8})["']?|(?:bg|background)\s*[:=]\s*["']?(#[0-9a-zA-Z]{3,8})["']?[^>\]]*?(?:fg|color)\s*[:=]\s*["']?(#[0-9a-zA-Z]{3,8})["']?/gi;

  let contrastMatch: RegExpExecArray | null;
  while ((contrastMatch = contrastPairRegex.exec(sText)) !== null) {
    const start = contrastMatch.index;
    const end = start + contrastMatch[0].length;
    const matchedStr = sText.slice(start, end);

    const fgHex = contrastMatch[1] || contrastMatch[4];
    const bgHex = contrastMatch[2] || contrastMatch[3];

    if (fgHex && bgHex) {
      try {
        const { ratio, passes } = checkWcagContrast(fgHex, bgHex);
        if (!passes) {
          const finding: Finding = {
            id: `WCAG_CONTRAST-${sentence.id}-${start}`,
            ruleId: 'WCAG_CONTRAST',
            category: 'A11Y_ASSET_AUDIT' as unknown as Finding['category'],
            severity: 'VIOLATION',
            sentenceId: sentence.id,
            startOffset: start,
            endOffset: end,
            flaggedText: matchedStr,
            explanation: `WCAG AA contrast ratio of ${ratio}:1 fails minimum required 4.5:1 threshold (fg: ${fgHex}, bg: ${bgHex}).`,
            evidence: {
              ruleId: 'WCAG_CONTRAST',
              ruleDescription: 'Text contrast against background must be at least 4.5:1 for WCAG AA compliance.',
              ratio,
            } as any,
          };
          (finding as any).ratio = ratio;
          accumulator.push(finding);
        }
      } catch {
        // Invalid hex format -> error caught, no finding emitted per §0
      }
    }
  }
}

/**
 * Detects claim candidate indicators:
 * - Percentages (e.g., 50%, 14.5%)
 * - Bare number > 100 or formatted numbers (e.g. 5,000) followed by a noun
 * - Guarantee words: guarantee / guaranteed / warranty
 * - Superlatives: best, fastest, #1
 */
function detectClaimCandidates(sentence: ParsedSentence, accumulator: Finding[]): void {
  const sText = sentence.text;
  // Support percentages, numbers >= 100 or formatted numbers like 5,000 before nouns, guarantees, superlatives
  const candidateRegex =
    /(\b\d+(?:\.\d+)?%|\b(?:\d{1,3}(?:,\d{3})+|10[1-9]|1[1-9]\d|[2-9]\d{2,}|\d{4,})\s+[a-zA-Z]+\b|\b(?:guarantee|guaranteed|warranty)\b|\b(?:best|fastest|#1)\b)/gi;

  let match: RegExpExecArray | null;
  while ((match = candidateRegex.exec(sText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const matchedStr = sText.slice(start, end);

    accumulator.push({
      id: `CLAIM_DETECTOR-${sentence.id}-${start}`,
      ruleId: 'CLAIM_DETECTOR',
      category: 'CLAIM_CANDIDATE',
      severity: 'CANDIDATE',
      sentenceId: sentence.id,
      startOffset: start,
      endOffset: end,
      flaggedText: matchedStr,
      candidateText: matchedStr,
      explanation: `Detected potential objective claim candidate "${matchedStr}" requiring factual substantiation.`,
      evidence: {
        ruleId: 'CLAIM_DETECTOR',
        ruleDescription: 'Identifies objective metrics, guarantees, and superlatives for factual verification.',
      },
    });
  }
}

/**
 * Deduplicates overlapping findings on identical (ruleId, sentenceId, startOffset, endOffset).
 * If spans overlap across different rules, keeps the one with higher severity.
 * Sorts by:
 * 1. Severity: VIOLATION > NOTICE > CANDIDATE
 * 2. Sentence ID: S1 < S2 < ... (numeric sentence order)
 * 3. Start offset: asc
 */
function deduplicateAndSortFindings(findings: Finding[]): Finding[] {
  // First pass: deduplicate identical (ruleId, sentenceId, startOffset, endOffset)
  const exactKeySet = new Set<string>();
  const uniqueFindings: Finding[] = [];

  for (const f of findings) {
    const key = `${f.ruleId}:${f.sentenceId}:${f.startOffset}:${f.endOffset}`;
    if (!exactKeySet.has(key)) {
      exactKeySet.add(key);
      uniqueFindings.push(f);
    }
  }

  // Second pass: handle span overlaps (same sentenceId and overlapping [startOffset, endOffset])
  // When spans overlap across rules, keep higher severity (VIOLATION > NOTICE > CANDIDATE)
  const severityRank: Record<FindingSeverity, number> = {
    VIOLATION: 3,
    NOTICE: 2,
    CANDIDATE: 1,
  };

  const finalFindings: Finding[] = [];
  for (const candidate of uniqueFindings) {
    // Check if overlaps with an already accepted finding in the same sentence
    const overlapIdx = finalFindings.findIndex(
      (f) =>
        f.sentenceId === candidate.sentenceId &&
        f.startOffset < candidate.endOffset &&
        candidate.startOffset < f.endOffset
    );

    if (overlapIdx === -1) {
      finalFindings.push(candidate);
    } else {
      const existing = finalFindings[overlapIdx];
      if (severityRank[candidate.severity] > severityRank[existing.severity]) {
        finalFindings[overlapIdx] = candidate;
      }
      // If equal or lower, keep the existing one (first seen)
    }
  }

  // Sort: severity desc, sentenceId asc (numeric), startOffset asc
  return finalFindings.sort((a, b) => {
    const sevDiff = severityRank[b.severity] - severityRank[a.severity];
    if (sevDiff !== 0) return sevDiff;

    const sNumA = parseInt(a.sentenceId.replace(/\D/g, '') || '0', 10);
    const sNumB = parseInt(b.sentenceId.replace(/\D/g, '') || '0', 10);
    if (sNumA !== sNumB) return sNumA - sNumB;

    return a.startOffset - b.startOffset;
  });
}
