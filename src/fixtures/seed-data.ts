import type { Rule, Fact } from '../engine/types';


export const SEED_RULES: Rule[] = [
  {
    id: 'RULE-01',
    description: 'Banned term: miracle',
    category: 'BANNED_PHRASE',
    severity: 'VIOLATION',
    enabled: true,
    explanation: 'Unsubstantiated therapeutic or cosmetic superlative.',
    matchingStrategy: {
      type: 'phrase',
      phrase: 'miracle',
      caseSensitive: false,
      wordBoundary: true,
    },
  },
  {
    id: 'RULE-02',
    description: 'Mandatory clinical trial disclaimer',
    category: 'REQUIRED_DISCLAIMER',
    severity: 'VIOLATION',
    enabled: true,
    explanation: 'Cosmetic claims must be accompanied by participant trial disclosure.',
    matchingStrategy: {
      type: 'requiredDisclosure',
      text: 'Results based on a 120-person study.',
      caseSensitive: false,
    },
  },
  {
    id: 'RULE-03',
    description: 'Trademark capitalization: HydraSerum',
    category: 'TRADEMARK_FORMAT',
    severity: 'VIOLATION',
    enabled: true,
    explanation: 'HydraSerum brand name must use camelCase styling.',
    matchingStrategy: {
      type: 'regex',
      pattern: '\\bhydraserum\\b',
      flags: 'i',
      expectedFormat: 'HydraSerum',
    },
  },
];

export const SEED_FACTS: Fact[] = [
  {
    id: 'FACT-04',
    statement: 'HydraSerum improves skin hydration within 14 days in a 120-person study.',
    sourceName: 'Clinical Trial Report CT-2026-A',
    sourceUrl: 'https://clinicaltrials.example.com/ct-2026-a',
    version: 1,
    metadata: {
      sampleSize: '120',
      durationDays: '14',
    },
  },
];

export const SEED_DRAFT = 'Our miracle HydraSerum guarantees 50% wrinkle reduction in 3 days!';

