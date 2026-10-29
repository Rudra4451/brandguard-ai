import { describe, it, expect } from 'vitest';
import { inspect, checkWcagContrast } from './deterministic';
import { RulebookStore } from './rulebook';
import { FactStore } from './fact-store';
import { verifyClaim } from './claim-verifier';
import { parseSentences } from './sentence-parser';
import type { Rule } from './types';
import { SEED_RULES, SEED_FACTS } from '../fixtures/seed-data';


describe('Deterministic Governance Engine', () => {
  const baseRules: Rule[] = [
    {
      id: 'RULE-01',
      description: 'Banned term: miracle',
      category: 'BANNED_PHRASE',
      severity: 'VIOLATION',
      enabled: true,
      matchingStrategy: {
        type: 'phrase',
        phrase: 'miracle',
        caseSensitive: false,
        wordBoundary: true,
      },
    },
    {
      id: 'RULE-02',
      description: 'Discouraged term: easy',
      category: 'DISCOURAGED_TERM',
      severity: 'NOTICE',
      enabled: true,
      matchingStrategy: {
        type: 'phrase',
        phrase: 'easy',
        caseSensitive: false,
        wordBoundary: true,
      },
    },
    {
      id: 'RULE-03',
      description: 'Mandatory disclaimer',
      category: 'REQUIRED_DISCLAIMER',
      severity: 'VIOLATION',
      enabled: true,
      matchingStrategy: {
        type: 'requiredDisclosure',
        text: 'Individual results may vary.',
        caseSensitive: false,
      },
    },
    {
      id: 'RULE-04',
      description: 'Trademark format for BrandX',
      category: 'TRADEMARK_FORMAT',
      severity: 'VIOLATION',
      enabled: true,
      matchingStrategy: {
        type: 'regex',
        pattern: '\\bbrandx\\b',
        flags: 'i',
        expectedFormat: 'BrandX',
      },
    },
    {
      id: 'RULE-05',
      description: 'Twitter channel limit 100',
      category: 'CHANNEL_LIMIT',
      severity: 'VIOLATION',
      enabled: true,
      matchingStrategy: {
        type: 'channelLimit',
        channel: 'Twitter',
        maxChars: 100,
      },
    },
    {
      id: 'RULE-06',
      description: 'Tone guidance note',
      category: 'TONE_GUIDANCE',
      severity: 'NOTICE',
      enabled: true,
      matchingStrategy: {
        type: 'toneNote',
        guidance: 'Maintain calm, professional demeanor.',
      },
    },
  ];

  it('empty draft produces zero findings and zero candidates', () => {
    const findings = inspect('', baseRules, [], 'Web');
    expect(findings).toEqual([]);
  });

  it('draft with only whitespace produces zero findings and zero candidates', () => {
    const findings = inspect('   \n\n\t  ', baseRules, [], 'Web');
    expect(findings).toEqual([]);
  });

  it('handles Unicode draft (Hindi, emoji, RTL) with stable sentence IDs and offsets', () => {
    const unicodeDraft = 'नमस्ते दोस्तों! यह एक परीक्षण है ✨. مرحبا بك.';
    const sentences = parseSentences(unicodeDraft);
    expect(sentences.length).toBe(3);
    expect(sentences[0].id).toBe('S1');
    expect(sentences[1].id).toBe('S2');
    expect(sentences[2].id).toBe('S3');

    // Re-parsing gives exact same IDs
    const secondPass = parseSentences(unicodeDraft);
    expect(secondPass).toEqual(sentences);
  });

  it('detects banned phrase at start, middle, and end of draft', () => {
    const draft = 'Miracle product now. Try our miracle daily. Experience the true miracle.';
    const findings = inspect(draft, [baseRules[0]], [], 'Web');
    expect(findings.length).toBe(3);
    expect(findings[0].flaggedText.toLowerCase()).toBe('miracle');
    expect(findings[1].flaggedText.toLowerCase()).toBe('miracle');
    expect(findings[2].flaggedText.toLowerCase()).toBe('miracle');
  });

  it('does NOT flag banned phrase when it is a substring of a longer word (word boundary)', () => {
    // "miracles" or "miracleous" with wordBoundary=true should not match "miracle"
    const draft = 'Look at this miraculous formulation with nonmiracle components.';
    const findings = inspect(draft, [baseRules[0]], [], 'Web');
    expect(findings).toEqual([]);
  });

  it('produces two distinct finding IDs when the same banned phrase appears twice', () => {
    const draft = 'Our miracle cream works like a miracle.';
    const findings = inspect(draft, [baseRules[0]], [], 'Web');
    expect(findings.length).toBe(2);
    expect(findings[0].id).not.toBe(findings[1].id);
    expect(findings[0].startOffset).toBe(4);
    expect(findings[1].startOffset).toBe(31);
  });

  it('missing required disclaimer produces exactly one finding anchored on the last sentence', () => {
    const draft = 'First sentence here. Second sentence here. Third sentence here.';
    const findings = inspect(draft, [baseRules[2]], [], 'Web');
    expect(findings.length).toBe(1);
    expect(findings[0].ruleId).toBe('RULE-03');
    expect(findings[0].sentenceId).toBe('S3');
    expect(findings[0].severity).toBe('VIOLATION');
  });

  it('channel limit exceeded by 1 character produces one finding at correct offset', () => {
    // Exactly 101 characters
    const draft = 'a'.repeat(101);
    const findings = inspect(draft, [baseRules[4]], [], 'Twitter');
    expect(findings.length).toBe(1);
    expect(findings[0].category).toBe('CHANNEL_LIMIT');
    expect(findings[0].startOffset).toBe(100);
    expect(findings[0].endOffset).toBe(101);
  });

  it('channel limit exactly at max produces zero findings', () => {
    const draft = 'a'.repeat(100);
    const findings = inspect(draft, [baseRules[4]], [], 'Twitter');
    expect(findings.length).toBe(0);
  });

  it('trademark regex match flags wrong capitalization with expected format', () => {
    const draft = 'Try brandx today!';
    const findings = inspect(draft, [baseRules[3]], [], 'Web');
    expect(findings.length).toBe(1);
    expect(findings[0].category).toBe('TRADEMARK_FORMAT');
    expect(findings[0].flaggedText).toBe('brandx');
    expect(findings[0].explanation).toContain('expected "BrandX"');
  });

  it('trademark correctly formatted produces zero findings', () => {
    const draft = 'Try BrandX today!';
    const findings = inspect(draft, [baseRules[3]], [], 'Web');
    expect(findings.length).toBe(0);
  });

  it('claim candidate flags "Guaranteed 50% wrinkle reduction" as CANDIDATE', () => {
    const draft = 'Guaranteed 50% wrinkle reduction in 3 days!';
    const findings = inspect(draft, [], [], 'Web');
    // Finds "Guaranteed" and "50%"
    expect(findings.length).toBeGreaterThanOrEqual(1);
    const candidate = findings.find((f) => f.category === 'CLAIM_CANDIDATE');
    expect(candidate).toBeDefined();
    expect(candidate?.severity).toBe('CANDIDATE');
    expect(candidate?.ruleId).toBe('CLAIM_DETECTOR');
  });

  it('claim verifier stub returns UNVERIFIED for every candidate', () => {
    const candidateFinding = {
      id: 'CLAIM_DETECTOR-S1-0',
      ruleId: 'CLAIM_DETECTOR',
      category: 'CLAIM_CANDIDATE' as const,
      severity: 'CANDIDATE' as const,
      sentenceId: 'S1',
      startOffset: 0,
      endOffset: 10,
      flaggedText: 'Guaranteed',
      candidateText: 'Guaranteed',
      explanation: 'Test claim candidate',
      evidence: {
        ruleId: 'CLAIM_DETECTOR',
        ruleDescription: 'Test',
      },
    };
    const res = verifyClaim(candidateFinding, SEED_FACTS);
    expect(res.status).toBe('UNVERIFIED');
    expect(res.reason).toBe('AI_VERIFIER_NOT_IMPLEMENTED');
  });

  it('overlapping findings keep the higher-severity finding', () => {
    // Overlapping rule on the word "miracle": one VIOLATION, one NOTICE
    const overlapRules: Rule[] = [
      {
        id: 'RULE-01',
        description: 'Banned: miracle',
        category: 'BANNED_PHRASE',
        severity: 'VIOLATION',
        enabled: true,
        matchingStrategy: {
          type: 'phrase',
          phrase: 'miracle',
          caseSensitive: false,
          wordBoundary: true,
        },
      },
      {
        id: 'RULE-02',
        description: 'Discouraged: miracle',
        category: 'DISCOURAGED_TERM',
        severity: 'NOTICE',
        enabled: true,
        matchingStrategy: {
          type: 'phrase',
          phrase: 'miracle',
          caseSensitive: false,
          wordBoundary: true,
        },
      },
    ];

    const draft = 'The miracle cream.';
    const findings = inspect(draft, overlapRules, [], 'Web');
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('VIOLATION');
    expect(findings[0].ruleId).toBe('RULE-01');
  });

  it('sorts findings by severity (VIOLATION > NOTICE > CANDIDATE), sentenceId asc, startOffset asc', () => {
    const rules: Rule[] = [
      {
        id: 'RULE-01',
        description: 'Banned word',
        category: 'BANNED_PHRASE',
        severity: 'VIOLATION',
        enabled: true,
        matchingStrategy: { type: 'phrase', phrase: 'banned', caseSensitive: false, wordBoundary: true },
      },
      {
        id: 'RULE-02',
        description: 'Discouraged word',
        category: 'DISCOURAGED_TERM',
        severity: 'NOTICE',
        enabled: true,
        matchingStrategy: { type: 'phrase', phrase: 'discouraged', caseSensitive: false, wordBoundary: true },
      },
    ];

    const draft = 'S1 has discouraged term. S2 has banned word and 50% claim.';
    const findings = inspect(draft, rules, [], 'Web');

    // Expected order:
    // 1. VIOLATION in S2 (banned)
    // 2. NOTICE in S1 (discouraged)
    // 3. CANDIDATE in S2 (50%)
    expect(findings.length).toBe(3);
    expect(findings[0].severity).toBe('VIOLATION');
    expect(findings[0].sentenceId).toBe('S2');
    expect(findings[1].severity).toBe('NOTICE');
    expect(findings[1].sentenceId).toBe('S1');
    expect(findings[2].severity).toBe('CANDIDATE');
    expect(findings[2].sentenceId).toBe('S2');
  });

  it('deleted fact does not crash inspection', () => {
    const factStore = new FactStore(SEED_FACTS);
    factStore.delete('FACT-04');
    expect(factStore.get('FACT-04')).toBeUndefined();

    // Inspection should run cleanly with empty facts
    const findings = inspect('HydraSerum is great.', SEED_RULES, factStore.list(), 'Web');
    expect(Array.isArray(findings)).toBe(true);
  });

  it('rule mutation changes rulebookVersion hash', async () => {
    const store = new RulebookStore(SEED_RULES);
    const v1 = await store.getVersion();
    expect(v1.length).toBe(12);

    await store.create({
      id: 'RULE-99',
      description: 'New temporary rule',
      category: 'BANNED_PHRASE',
      severity: 'VIOLATION',
      enabled: true,
      matchingStrategy: {
        type: 'phrase',
        phrase: 'forbidden',
        caseSensitive: false,
        wordBoundary: true,
      },
    });

    const v2 = await store.getVersion();
    expect(v2).not.toBe(v1);

    await store.delete('RULE-99');
    const v3 = await store.getVersion();
    expect(v3).toBe(v1); // Returns to original hash when restored
  });

  it('malformed rule import is rejected with error, existing rules untouched', async () => {
    const store = new RulebookStore(SEED_RULES);
    const originalRules = store.list();

    const malformedJson = JSON.stringify({
      rules: [
        {
          id: 'INVALID-ID', // Violates RULE-XX format
          description: 'Broken rule',
        },
      ],
    });

    await expect(store.importJSON(malformedJson)).rejects.toThrow();
    expect(store.list()).toEqual(originalRules);
  });

  it('malformed fact import is rejected with error, existing facts untouched', () => {
    const store = new FactStore(SEED_FACTS);
    const originalFacts = store.list();

    const malformedJson = JSON.stringify({
      facts: [
        {
          id: 'INVALID-FACT', // Violates FACT-XX format
          statement: '',
        },
      ],
    });

    expect(() => store.importJSON(malformedJson)).toThrow();
    expect(store.list()).toEqual(originalFacts);
  });

  it('fact with empty statement is rejected on create AND on import', () => {
    const store = new FactStore();

    expect(() =>
      store.create({
        id: 'FACT-01',
        statement: '',
        sourceName: 'Source A',
      })
    ).toThrow();

    const emptyStatementJson = JSON.stringify({
      facts: [
        {
          id: 'FACT-01',
          statement: '',
          sourceName: 'Source A',
        },
      ],
    });

    expect(() => store.importJSON(emptyStatementJson)).toThrow();
  });
});

describe('WCAG 2.1 Contrast and Accessibility Asset Audit (§0)', () => {
  it('1. #000000 on #ffffff -> ratio 21:1, passes', () => {
    const result = checkWcagContrast('#000000', '#ffffff');
    expect(result.ratio).toBe(21);
    expect(result.passes).toBe(true);
  });

  it('2. #cbd5e1 on #ffffff -> ratio ~1.49:1 (1.48:1), fails', () => {
    const result = checkWcagContrast('#cbd5e1', '#ffffff');
    expect(result.ratio).toBeCloseTo(1.48, 1);
    expect(result.passes).toBe(false);
  });

  it('3. #767676 on #ffffff -> ~4.54:1, passes (exact threshold boundary)', () => {
    const result = checkWcagContrast('#767676', '#ffffff');
    expect(result.ratio).toBe(4.54);
    expect(result.passes).toBe(true);
  });

  it('4. #777777 on #ffffff -> ~4.48:1, fails', () => {
    const result = checkWcagContrast('#777777', '#ffffff');
    expect(result.ratio).toBe(4.48);
    expect(result.passes).toBe(false);
  });

  it('5. Invalid hex -> throws error, and no finding emitted by inspect', () => {
    expect(() => checkWcagContrast('not-a-color', '#ffffff')).toThrow();
    expect(() => checkWcagContrast('#12', '#ffffff')).toThrow();

    // In inspect, draft with invalid hex should catch error and emit zero contrast findings
    const draft = 'Product copy [asset: fg="invalid-hex", bg="#ffffff"]';
    const findings = inspect(draft, [], [], 'Web');
    const contrastFindings = findings.filter((f) => f.ruleId === 'WCAG_CONTRAST');
    expect(contrastFindings.length).toBe(0);
  });

  it('emits WCAG_ALT_TEXT and WCAG_CONTRAST findings for accessibility violations', () => {
    const draft = 'Try our serum. [asset: alt="", fg="#cbd5e1", bg="#ffffff"]';
    const findings = inspect(draft, [], [], 'Email');

    const altFinding = findings.find((f) => f.ruleId === 'WCAG_ALT_TEXT');
    expect(altFinding).toBeDefined();
    expect(altFinding?.severity).toBe('VIOLATION');
    expect(altFinding?.category).toBe('A11Y_ASSET_AUDIT');

    const contrastFinding = findings.find((f) => f.ruleId === 'WCAG_CONTRAST');
    expect(contrastFinding).toBeDefined();
    expect(contrastFinding?.severity).toBe('VIOLATION');
    expect(contrastFinding?.category).toBe('A11Y_ASSET_AUDIT');
    if (contrastFinding && 'evidence' in contrastFinding) {
      expect((contrastFinding.evidence as any).ratio).toBeLessThan(4.5);
    }
  });
});

