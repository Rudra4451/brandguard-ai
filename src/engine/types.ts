import { z } from 'zod';

export const RuleCategorySchema = z.enum([
  'BANNED_PHRASE',
  'DISCOURAGED_TERM',
  'REQUIRED_DISCLAIMER',
  'TRADEMARK_FORMAT',
  'CHANNEL_LIMIT',
  'TONE_GUIDANCE',
]);
export type RuleCategory = z.infer<typeof RuleCategorySchema>;

export const RuleSeveritySchema = z.enum(['VIOLATION', 'NOTICE']);
export type RuleSeverity = z.infer<typeof RuleSeveritySchema>;

export const PhraseMatchingStrategySchema = z.object({
  type: z.literal('phrase'),
  phrase: z.string().min(1, 'Phrase must not be empty'),
  caseSensitive: z.boolean(),
  wordBoundary: z.boolean(),
});

export const RequiredDisclaimerStrategySchema = z.object({
  type: z.literal('requiredDisclosure'),
  text: z.string().min(1, 'Disclaimer text must not be empty'),
  caseSensitive: z.boolean(),
});

export const TrademarkFormatStrategySchema = z.object({
  type: z.literal('regex'),
  pattern: z.string().min(1, 'Regex pattern must not be empty'),
  flags: z.string().default(''),
  expectedFormat: z.string().min(1, 'Expected format must not be empty'),
});

export const ChannelLimitStrategySchema = z.object({
  type: z.literal('channelLimit'),
  channel: z.string().min(1, 'Channel name must not be empty'),
  maxChars: z.number().int().positive('Max characters must be a positive integer'),
});

export const ToneGuidanceStrategySchema = z.object({
  type: z.literal('toneNote'),
  guidance: z.string().min(1, 'Guidance note must not be empty'),
});

export const MatchingStrategySchema = z.discriminatedUnion('type', [
  PhraseMatchingStrategySchema,
  RequiredDisclaimerStrategySchema,
  TrademarkFormatStrategySchema,
  ChannelLimitStrategySchema,
  ToneGuidanceStrategySchema,
]);
export type MatchingStrategy = z.infer<typeof MatchingStrategySchema>;

export const RuleSchema = z
  .object({
    id: z.string().regex(/^RULE-\d+$/, 'Rule ID must follow RULE-XX format'),
    description: z.string().min(1, 'Description is required'),
    category: RuleCategorySchema,
    severity: RuleSeveritySchema,
    enabled: z.boolean().default(true),
    explanation: z.string().optional(),
    matchingStrategy: MatchingStrategySchema,
  })
  .superRefine((data, ctx) => {
    // Severity validation rules:
    // BANNED_PHRASE, REQUIRED_DISCLAIMER, TRADEMARK_FORMAT, CHANNEL_LIMIT must be VIOLATION
    // DISCOURAGED_TERM must be NOTICE
    const violationCategories = [
      'BANNED_PHRASE',
      'REQUIRED_DISCLAIMER',
      'TRADEMARK_FORMAT',
      'CHANNEL_LIMIT',
    ];

    if (violationCategories.includes(data.category) && data.severity !== 'VIOLATION') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Category ${data.category} must have severity 'VIOLATION'`,
        path: ['severity'],
      });
    }

    if (data.category === 'DISCOURAGED_TERM' && data.severity !== 'NOTICE') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Category 'DISCOURAGED_TERM' must have severity 'NOTICE'",
        path: ['severity'],
      });
    }

    // Discriminated union alignment between category and strategy type
    if (
      (data.category === 'BANNED_PHRASE' || data.category === 'DISCOURAGED_TERM') &&
      data.matchingStrategy.type !== 'phrase'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Category ${data.category} requires a 'phrase' matchingStrategy`,
        path: ['matchingStrategy'],
      });
    }

    if (
      data.category === 'REQUIRED_DISCLAIMER' &&
      data.matchingStrategy.type !== 'requiredDisclosure'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Category 'REQUIRED_DISCLAIMER' requires a 'requiredDisclosure' matchingStrategy",
        path: ['matchingStrategy'],
      });
    }

    if (
      data.category === 'TRADEMARK_FORMAT' &&
      data.matchingStrategy.type !== 'regex'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Category 'TRADEMARK_FORMAT' requires a 'regex' matchingStrategy",
        path: ['matchingStrategy'],
      });
    }

    if (
      data.category === 'CHANNEL_LIMIT' &&
      data.matchingStrategy.type !== 'channelLimit'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Category 'CHANNEL_LIMIT' requires a 'channelLimit' matchingStrategy",
        path: ['matchingStrategy'],
      });
    }

    if (
      data.category === 'TONE_GUIDANCE' &&
      data.matchingStrategy.type !== 'toneNote'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Category 'TONE_GUIDANCE' requires a 'toneNote' matchingStrategy",
        path: ['matchingStrategy'],
      });
    }
  });

export type Rule = z.infer<typeof RuleSchema>;

export const FactSchema = z.object({
  id: z.string().regex(/^FACT-\d+$/, 'Fact ID must follow FACT-XX format'),
  statement: z.string().min(1, 'Fact statement must be non-empty'),
  sourceName: z.string().min(1, 'sourceName is required'),
  sourceUrl: z.string().url().optional(),
  version: z.number().int().nonnegative().default(1),
  metadata: z.record(z.string(), z.string()).optional(),
});
export type Fact = z.infer<typeof FactSchema>;

export const FindingSeveritySchema = z.enum(['VIOLATION', 'NOTICE', 'CANDIDATE']);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const FindingSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  category: z.union([RuleCategorySchema, z.literal('CLAIM_CANDIDATE')]),
  severity: FindingSeveritySchema,
  sentenceId: z.string().min(1),
  /**
   * startOffset and endOffset are UTF-16 code unit offsets
   * (JavaScript String.length semantics) within the specific sentence text,
   * NOT global offsets within the entire draft.
   */
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  flaggedText: z.string(),
  candidateText: z.string().optional(),
  explanation: z.string(),
  suggestedCorrection: z.string().optional(),
  evidence: z.object({
    ruleId: z.string(),
    ruleDescription: z.string(),
  }),
});
export type Finding = z.infer<typeof FindingSchema>;

export const RulebookSchema = z.object({
  rules: z.array(RuleSchema),
});
export type Rulebook = z.infer<typeof RulebookSchema>;

export const FactStoreSchema = z.object({
  facts: z.array(FactSchema),
});
export type FactStoreData = z.infer<typeof FactStoreSchema>;
