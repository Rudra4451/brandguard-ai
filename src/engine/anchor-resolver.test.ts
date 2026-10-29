import { describe, it, expect } from 'vitest';
import { Schema } from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { resolveFindingAnchor } from './anchor-resolver';
import type { Finding } from './types';


describe('Anchor Resolver', () => {
  const schema = new Schema({
    nodes: basicSchema.spec.nodes,
    marks: basicSchema.spec.marks,
  });

  function createDoc(text: string) {
    const paragraphs = text.split('\n\n');
    const pNodes = paragraphs.map((p) =>
      schema.node('paragraph', null, p ? [schema.text(p)] : [])
    );
    return schema.node('doc', null, pNodes);
  }

  const sampleFinding: Finding = {
    id: 'RULE-01-S1-4',
    ruleId: 'RULE-01',
    category: 'BANNED_PHRASE',
    severity: 'VIOLATION',
    sentenceId: 'S1',
    startOffset: 4,
    endOffset: 11, // "miracle" (7 chars)
    flaggedText: 'miracle',
    explanation: 'Banned term',
    suggestedCorrection: 'tested',
    evidence: { ruleId: 'RULE-01', ruleDescription: 'No miracle' },
  };

  it('maps sentence-relative offset to correct ProseMirror document positions', () => {
    // "Our miracle cream works."
    // S1 global start = 0. "miracle" is at chars 4..11.
    const doc = createDoc('Our miracle cream works.');
    const resolved = resolveFindingAnchor(doc, sampleFinding);
    expect(resolved).not.toBeNull();
    expect(resolved?.sentenceId).toBe('S1');

    // In ProseMirror with single paragraph: pos 0 is doc start, pos 1 is inside p.
    // char index 0 is at pos 1, char 4 is at pos 5, char 11 is at pos 12.
    expect(resolved?.from).toBe(5);
    expect(resolved?.to).toBe(12);
  });

  it('returns null if sentenceId does not exist in the document (orphaned finding)', () => {
    const doc = createDoc('Our miracle cream works.');
    const orphanedFinding: Finding = {
      ...sampleFinding,
      sentenceId: 'S99',
    };
    const resolved = resolveFindingAnchor(doc, orphanedFinding);
    expect(resolved).toBeNull();
  });

  it('cross-sentence stability: resolves finding on S2 when S1 is modified', () => {
    // Original S2 finding
    const s2Finding: Finding = {
      id: 'RULE-01-S2-4',
      ruleId: 'RULE-01',
      category: 'BANNED_PHRASE',
      severity: 'VIOLATION',
      sentenceId: 'S2',
      startOffset: 4,
      endOffset: 11,
      flaggedText: 'miracle',
      explanation: 'Banned term',
      evidence: { ruleId: 'RULE-01', ruleDescription: 'No miracle' },
    };

    // First document
    const doc1 = createDoc('First short sentence. The miracle cream works.');
    const res1 = resolveFindingAnchor(doc1, s2Finding);
    expect(res1?.sentenceId).toBe('S2');

    // Modify S1 by adding words ("A much longer modified first sentence.")
    const doc2 = createDoc('A much longer modified first sentence. The miracle cream works.');
    const res2 = resolveFindingAnchor(doc2, s2Finding);
    expect(res2?.sentenceId).toBe('S2');
    expect(res2?.from).toBeGreaterThan(res1!.from); // Offset shifted forward cleanly in PM
  });
});
