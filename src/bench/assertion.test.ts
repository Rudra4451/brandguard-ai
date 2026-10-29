import { describe, it, expect } from 'vitest';
import {
  assertClaimNotSupported,
  assertContradictedClaim,
  assertWcagContrastRatio,
  assertFindingsCount,
  aggregateRunResults,
} from './assertion-oracle';
import type { BenchRunOutput, PresetResult } from './types';
import type { ClaimVerification } from '../engine/claim-verifier';

describe('Judge Bench Assertion Oracle Tests (§5)', () => {
  // Helper to create mock BenchRunOutput
  const createMockOutput = (overrides: Partial<BenchRunOutput> = {}): BenchRunOutput => ({
    presetId: 'P1',
    draftId: 'TEST-DRAFT',
    draftText: 'Test draft text',
    findings: [],
    claimVerifications: new Map(),
    verifierMode: 'AI_OFFLINE_FALLBACK',
    ...overrides,
  });

  // 1. ExpectedCheck for "claim not SUPPORTED" passes when status is UNVERIFIED
  it('1. ExpectedCheck for "claim not SUPPORTED" passes when status is UNVERIFIED', () => {
    const claimMap = new Map<string, ClaimVerification>();
    claimMap.set('C1', {
      claimId: 'C1',
      status: 'UNVERIFIED',
      mode: 'OFFLINE_FALLBACK',
      sourceFactId: null,
      exactSourceQuote: null,
      rationale: 'Unverified claim',
    });

    const output = createMockOutput({
      claimVerifications: claimMap,
      verifierMode: 'AI_ACTIVE',
    });

    const result = assertClaimNotSupported(output);
    expect(result.passed).toBe(true);
    expect(result.status).toBe('PASS');
    expect(result.actual).toBe('UNVERIFIED');
  });

  // 2. Passes when status is AI_OFFLINE_FALLBACK
  it('2. Passes when status is AI_OFFLINE_FALLBACK', () => {
    const output = createMockOutput({
      claimVerifications: new Map(),
      verifierMode: 'AI_OFFLINE_FALLBACK',
    });

    const result = assertClaimNotSupported(output);
    expect(result.passed).toBe(true);
    expect(result.status).toBe('PASS');
    expect(result.actual).toBe('AI_OFFLINE_FALLBACK');
  });

  // 3. Fails when status is SUPPORTED
  it('3. Fails when status is SUPPORTED', () => {
    const claimMap = new Map<string, ClaimVerification>();
    claimMap.set('C1', {
      claimId: 'C1',
      status: 'SUPPORTED',
      mode: 'LIVE',
      sourceFactId: 'FACT-01',
      exactSourceQuote: 'Exact quote',
      rationale: 'Fully supported',
    });

    const output = createMockOutput({
      claimVerifications: claimMap,
      verifierMode: 'AI_ACTIVE',
    });

    const result = assertClaimNotSupported(output);
    expect(result.passed).toBe(false);
    expect(result.status).toBe('FAIL');
    expect(result.actual).toBe('SUPPORTED');
  });

  // 4. Conditional-pass preset 2 check 1: returns CONDITIONAL_PASS when verifier mode is AI_OFFLINE_FALLBACK, regardless of claim status
  it('4. Conditional-pass preset 2 check 1: returns CONDITIONAL_PASS when verifier mode is AI_OFFLINE_FALLBACK', () => {
    const claimMap = new Map<string, ClaimVerification>();
    claimMap.set('C1', {
      claimId: 'C1',
      status: 'UNVERIFIED',
      mode: 'OFFLINE_FALLBACK',
      sourceFactId: null,
      exactSourceQuote: null,
      rationale: 'Offline fallback',
    });

    const output = createMockOutput({
      presetId: 'P2',
      claimVerifications: claimMap,
      verifierMode: 'AI_OFFLINE_FALLBACK',
    });

    const result = assertContradictedClaim(output, '100%', 'FACT-ORIGIN', '92% natural-origin');
    expect(result.passed).toBe(true);
    expect(result.status).toBe('CONDITIONAL_PASS');
    expect(result.actual).toBe('AI_OFFLINE_FALLBACK');
  });

  // 5. Preset 3 ratio assertion: fails if reported ratio is exactly 4.5 (boundary)
  it('5. Preset 3 ratio assertion: fails if reported ratio is exactly 4.5 (boundary)', () => {
    const output = createMockOutput({
      presetId: 'P3',
      findings: [
        {
          id: 'F1',
          ruleId: 'WCAG_CONTRAST',
          category: 'A11Y_ASSET_AUDIT' as any,
          severity: 'VIOLATION',
          sentenceId: 'S1',
          startOffset: 0,
          endOffset: 10,
          flaggedText: 'fg="#767676"',
          explanation: 'WCAG AA contrast ratio of 4.5:1 fails minimum',
          evidence: { ruleId: 'WCAG_CONTRAST', ruleDescription: 'WCAG AA', ratio: 4.5 } as any,
          _source: 'ENGINE',
          ratio: 4.5,
        },
      ],
      contrastRatio: 4.5,
    });

    const result = assertWcagContrastRatio(output);
    expect(result.passed).toBe(false);
    expect(result.status).toBe('FAIL');
    expect(result.actual).toContain('4.5:1');
  });

  // 6. Preset 3 ratio assertion: fails if ratio is undefined even when passes: false (no numeric evidence -> no pass)
  it('6. Preset 3 ratio assertion: fails if ratio is undefined even when finding exists', () => {
    const output = createMockOutput({
      presetId: 'P3',
      findings: [
        {
          id: 'F1',
          ruleId: 'WCAG_CONTRAST',
          category: 'A11Y_ASSET_AUDIT' as any,
          severity: 'VIOLATION',
          sentenceId: 'S1',
          startOffset: 0,
          endOffset: 10,
          flaggedText: 'fg="#cbd5e1"',
          explanation: 'WCAG AA contrast ratio fails threshold without numeric ratio',
          evidence: { ruleId: 'WCAG_CONTRAST', ruleDescription: 'WCAG AA' } as any,
          _source: 'ENGINE',
        },
      ],
      contrastRatio: undefined,
    });

    const result = assertWcagContrastRatio(output);
    expect(result.passed).toBe(false);
    expect(result.status).toBe('FAIL');
    expect(result.actual).toContain('ratio undefined');
  });

  // 7. Zero findings when findings expected -> FAIL
  it('7. Zero findings when findings expected -> FAIL', () => {
    const output = createMockOutput({
      findings: [],
    });

    const result = assertFindingsCount(output, 2);
    expect(result.passed).toBe(false);
    expect(result.status).toBe('FAIL');
    expect(result.actual).toBe('0 findings returned');
  });

  // 8. Run all aggregates correctly (3 PASS, 1 CONDITIONAL_PASS, 0 FAIL)
  it('8. Run all aggregates correctly (3 PASS, 1 CONDITIONAL_PASS, 0 FAIL)', () => {
    const mockResults: PresetResult[] = [
      {
        presetId: 'P1',
        name: 'Preset 1',
        status: 'PASS',
        durationMs: 15,
        findings: [],
        claimVerifications: new Map(),
        checkResults: [],
        rawOutput: createMockOutput(),
      },
      {
        presetId: 'P2',
        name: 'Preset 2',
        status: 'CONDITIONAL_PASS',
        durationMs: 400,
        findings: [],
        claimVerifications: new Map(),
        checkResults: [],
        rawOutput: createMockOutput(),
      },
      {
        presetId: 'P3',
        name: 'Preset 3',
        status: 'PASS',
        durationMs: 12,
        findings: [],
        claimVerifications: new Map(),
        checkResults: [],
        rawOutput: createMockOutput(),
      },
      {
        presetId: 'P4',
        name: 'Preset 4',
        status: 'PASS',
        durationMs: 35,
        findings: [],
        claimVerifications: new Map(),
        checkResults: [],
        rawOutput: createMockOutput(),
      },
    ];

    const summary = aggregateRunResults(mockResults);
    expect(summary.total).toBe(4);
    expect(summary.passCount).toBe(3);
    expect(summary.conditionalPassCount).toBe(1);
    expect(summary.failCount).toBe(0);
    expect(summary.skippedCount).toBe(0);
    expect(summary.totalDurationMs).toBe(462);
  });

  // §4 Namespaced reset test
  it('resets preset namespace without affecting non-preset drafts, rules, facts, and events', async () => {
    const { resetPreset, filterPresetRules, filterPresetFacts, AuditPersistenceStore } = await import('../storage/db');

    // Seed non-preset and preset-1 events
    const initialEvents: import('../engine/audit-chain').AuditEvent[] = [
      {
        eventId: 'EVT-0001',
        action: 'DRAFT_CREATED' as const,
        actorRole: 'AUTHOR' as const,
        draftId: 'DRAFT-01', // Non-preset
        draftFingerprint: 'fp-nonpreset',
        payload: {},
        timestamp: new Date().toISOString(),
        prevHash: 'genesis',
        hash: 'h1',
      },
      {
        eventId: 'EVT-0002',
        action: 'DRAFT_CREATED' as const,
        actorRole: 'REVIEWER' as const,
        draftId: 'PRESET-1-DRAFT', // Preset 1
        draftFingerprint: 'fp-preset-1',
        payload: {},
        timestamp: new Date().toISOString(),
        prevHash: 'h1',
        hash: 'h2',
      },
    ];

    AuditPersistenceStore.saveEvents(initialEvents);

    // Seed rules and facts
    const rules = [
      { id: 'RULE-01', description: 'Non-preset rule' },
      { id: 'PRESET-1-RULE-FIN-01', description: 'Preset 1 rule' },
    ];
    const facts = [
      { id: 'FACT-01', statement: 'Non-preset fact' },
      { id: 'PRESET-1-FACT-01', statement: 'Preset 1 fact' },
    ];

    // Reset Preset 1
    await resetPreset('P1');

    // Verify events: Preset 1 event deleted, non-preset event intact
    const remainingEvents = AuditPersistenceStore.loadEvents();
    expect(remainingEvents.length).toBe(1);
    expect(remainingEvents[0].draftId).toBe('DRAFT-01');

    // Verify rules & facts filtering
    const remainingRules = filterPresetRules(rules, 'P1');
    expect(remainingRules.length).toBe(1);
    expect(remainingRules[0].id).toBe('RULE-01');

    const remainingFacts = filterPresetFacts(facts, 'P1');
    expect(remainingFacts.length).toBe(1);
    expect(remainingFacts[0].id).toBe('FACT-01');
  });
});
