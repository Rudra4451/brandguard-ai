import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InsightsView } from './InsightsView';
import type { AuditEvent } from '../engine/audit-chain';

function createMockEvent(overrides: Partial<AuditEvent>): AuditEvent {
  return {
    eventId: `EVT-${Math.random().toString(36).slice(2, 6)}`,
    action: 'AUDIT_RUN',
    actorRole: 'REVIEWER',
    draftId: 'DRAFT-01',
    draftFingerprint: 'mock-fp',
    payload: {},
    timestamp: new Date().toISOString(),
    prevHash: 'prev',
    hash: 'hash',
    ...overrides,
  };
}

describe('InsightsView — Strict Metric & Threshold Governance', () => {
  // Test 1: Total event count = 0 -> all sections render empty state, no percentage displayed
  it('1. Total event count = 0 -> all sections render empty state, no percentage displayed', () => {
    const html = renderToStaticMarkup(React.createElement(InsightsView, { events: [] }));
    expect(html).toContain('No audit history yet. Insights appear after the first review cycle.');
    expect(html).not.toContain('%');
    expect(html).not.toContain('A. Recorded Audit Event Counts');
  });

  // Test 2: 2 audit events -> Section B does NOT render (below 3 threshold)
  it('2. 2 audit events -> Section B does NOT render (below 3 threshold)', () => {
    const events: AuditEvent[] = [
      createMockEvent({ action: 'AUDIT_RUN', payload: { categories: ['BANNED_PHRASE'] } }),
      createMockEvent({ action: 'AUDIT_RUN', payload: { categories: ['REQUIRED_DISCLAIMER'] } }),
    ];
    const html = renderToStaticMarkup(React.createElement(InsightsView, { events }));
    expect(html).toContain('Not enough audit history to show category trends (2 of 3 required).');
    expect(html).not.toContain('BANNED_PHRASE');
  });

  // Test 3: 3 audit events -> Section B renders, and every percentage has a visible denominator in the same string
  it('3. 3 audit events -> Section B renders, and every percentage has a visible denominator in the same string', () => {
    const events: AuditEvent[] = [
      createMockEvent({ action: 'AUDIT_RUN', payload: { categories: ['BANNED_PHRASE'] } }),
      createMockEvent({ action: 'AUDIT_RUN', payload: { categories: ['BANNED_PHRASE'] } }),
      createMockEvent({ action: 'AUDIT_RUN', payload: { categories: ['REQUIRED_DISCLAIMER'] } }),
    ];
    const html = renderToStaticMarkup(React.createElement(InsightsView, { events }));
    expect(html).not.toContain('Not enough audit history to show category trends');
    expect(html).toContain('BANNED_PHRASE');
    expect(html).toContain('2 observed across 3 audit runs');
  });

  // Test 4: 4 override events total -> Section C does NOT render (below 5 threshold)
  it('4. 4 override events total -> Section C does NOT render (below 5 threshold)', () => {
    const events: AuditEvent[] = [
      createMockEvent({ action: 'FINDING_OVERRIDE', payload: { ruleId: 'RULE-01' } }),
      createMockEvent({ action: 'FINDING_OVERRIDE', payload: { ruleId: 'RULE-01' } }),
      createMockEvent({ action: 'FINDING_OVERRIDE', payload: { ruleId: 'RULE-02' } }),
      createMockEvent({ action: 'FINDING_OVERRIDE', payload: { ruleId: 'RULE-02' } }),
    ];
    const html = renderToStaticMarkup(React.createElement(InsightsView, { events }));
    expect(html).toContain('Not enough override history to evaluate rule exceptions (4 of 5 required).');
  });

  // Test 5: 5 override events total -> Section C renders
  it('5. 5 override events total -> Section C renders', () => {
    const events: AuditEvent[] = [
      createMockEvent({ action: 'FINDING_OVERRIDE', payload: { ruleId: 'RULE-01' } }),
      createMockEvent({ action: 'FINDING_OVERRIDE', payload: { ruleId: 'RULE-01' } }),
      createMockEvent({ action: 'FINDING_OVERRIDE', payload: { ruleId: 'RULE-01' } }),
      createMockEvent({ action: 'FINDING_OVERRIDE', payload: { ruleId: 'RULE-02' } }),
      createMockEvent({ action: 'FINDING_OVERRIDE', payload: { ruleId: 'RULE-02' } }),
    ];
    const html = renderToStaticMarkup(React.createElement(InsightsView, { events }));
    expect(html).not.toContain('Not enough override history to evaluate rule exceptions');
    expect(html).toContain('RULE-01');
    expect(html).toContain('3 overrides out of 5 total overrides');
  });

  // Test 6: A rule with 3 findings, 2 overridden -> NOT in Section E (below 5 threshold)
  it('6. A rule with 3 findings, 2 overridden -> NOT in Section E (below 5 threshold)', () => {
    const events: AuditEvent[] = [
      createMockEvent({ action: 'FINDING_OVERRIDE', payload: { ruleId: 'RULE-01' } }),
      createMockEvent({ action: 'FINDING_OVERRIDE', payload: { ruleId: 'RULE-01' } }),
      createMockEvent({ action: 'FINDING_DISMISSED', payload: { ruleId: 'RULE-01' } }),
    ];
    const html = renderToStaticMarkup(React.createElement(InsightsView, { events }));
    expect(html).toContain('No rules have reached the minimum 5 recorded findings threshold for friction analysis.');
    expect(html).not.toContain('RULE-01</td><td class="p-2">3 findings');
  });

  // Test 7: A rule with 5 findings, 3 overridden -> IS in Section E, raw counts shown, no best/worst ranking word appears
  it('7. A rule with 5 findings, 3 overridden -> IS in Section E, raw counts shown, no best/worst ranking word appears', () => {
    const events: AuditEvent[] = [
      createMockEvent({ action: 'FINDING_OVERRIDE', payload: { ruleId: 'RULE-FRICTION-01' } }),
      createMockEvent({ action: 'FINDING_OVERRIDE', payload: { ruleId: 'RULE-FRICTION-01' } }),
      createMockEvent({ action: 'FINDING_OVERRIDE', payload: { ruleId: 'RULE-FRICTION-01' } }),
      createMockEvent({ action: 'FINDING_DISMISSED', payload: { ruleId: 'RULE-FRICTION-01' } }),
      createMockEvent({ action: 'FINDING_DISMISSED', payload: { ruleId: 'RULE-FRICTION-01' } }),
    ];
    const html = renderToStaticMarkup(React.createElement(InsightsView, { events }));
    expect(html).toContain('RULE-FRICTION-01');
    expect(html).toContain('5 findings');
    expect(html).toContain('3 overridden, 2 dismissed, 0 upheld');
    expect(html.toLowerCase()).not.toContain('best');
    expect(html.toLowerCase()).not.toContain('worst');
    expect(html.toLowerCase()).not.toContain('reduced by');
    expect(html.toLowerCase()).not.toContain('improved');
  });

  // Test 8: Any percentage rendered without an explicit "/ N" or "N of M" in the same string -> test FAILS
  it('8. Any percentage rendered without an explicit "/ N" or "N of M" in the same string -> test FAILS', () => {
    const events: AuditEvent[] = [
      createMockEvent({ action: 'AUDIT_RUN', payload: { categories: ['BANNED_PHRASE'] } }),
      createMockEvent({ action: 'AUDIT_RUN', payload: { categories: ['BANNED_PHRASE'] } }),
      createMockEvent({ action: 'AUDIT_RUN', payload: { categories: ['BANNED_PHRASE'] } }),
      createMockEvent({ action: 'APPROVED', payload: {} }),
      createMockEvent({ action: 'REJECTED', payload: {} }),
      createMockEvent({ action: 'APPROVAL_INVALIDATED', payload: {} }),
    ];
    const html = renderToStaticMarkup(React.createElement(InsightsView, { events }));

    // Find all text nodes containing a percentage "%"
    const textSegments = html.replace(/<[^>]+>/g, '§§§').split('§§§').filter((s) => s.includes('%'));
    expect(textSegments.length).toBeGreaterThan(0);

    for (const seg of textSegments) {
      // Must contain either "of", "out of", or "/"
      const hasExplicitDenominator = /\b(of|out of|\/)\b/i.test(seg);
      expect(
        hasExplicitDenominator,
        `Percentage found without explicit denominator in string: "${seg}"`
      ).toBe(true);
    }
  });
});
