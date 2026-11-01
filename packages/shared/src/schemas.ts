import { z } from 'zod';
import {
  MAX_DISPLAY_NAME_LENGTH,
  MAX_OPTION_TITLE_LENGTH,
  MAX_RATING_REASON_LENGTH,
  MAX_ROOM_TITLE_LENGTH,
  MIN_DISPLAY_NAME_LENGTH,
  PHASES,
  RATING_MAX,
  RATING_MIN,
  ROOM_CODE_LENGTH,
} from './constants.js';

/**
 * Base schemas
 */
export const PhaseSchema = z.enum(PHASES);

export const ParticipantSchema = z.object({
  id: z.string(),
  name: z.string(),
  connected: z.boolean(),
  isAI: z.boolean(),
  joinedAt: z.number(),
});

export const OptionSchema = z.object({
  id: z.string(),
  title: z.string(),
  addedBy: z.string(),
  suggestedByAI: z.boolean(),
});

export const RatingSchema = z.object({
  score: z.number().int().min(RATING_MIN).max(RATING_MAX),
  reason: z.string().max(MAX_RATING_REASON_LENGTH).optional(),
});

export const DisagreementSchema = z.object({
  optionId: z.string(),
  highName: z.string(),
  lowName: z.string(),
  note: z.string(),
});

export const PerOptionAnalysisSchema = z.object({
  optionId: z.string(),
  mean: z.number(),
  spread: z.number(),
  verdict: z.enum(['consensus', 'contested', 'low']),
});

export const CompromiseSchema = z.object({
  optionId: z.string(),
  rationale: z.string(),
});

export const AnalysisSchema = z.object({
  perOption: z.array(PerOptionAnalysisSchema),
  disagreements: z.array(DisagreementSchema),
  compromise: CompromiseSchema,
  aiUnavailable: z.boolean(),
});

export const RoomSchema = z.object({
  id: z.string(),
  title: z.string(),
  phase: PhaseSchema,
  hostId: z.string(),
  participants: z.array(ParticipantSchema),
  options: z.array(OptionSchema),
  ratings: z.record(z.string(), z.record(z.string(), RatingSchema)),
  votes: z.record(z.string(), z.array(z.string())),
  analysis: AnalysisSchema.nullable(),
  summary: z.string().nullable(),
  locked: z.boolean(),
  createdAt: z.number(),
  lastActivity: z.number(),
});

/**
 * Client -> Server events
 */
export const RoomCreateSchema = z.object({
  title: z.string().min(1).max(MAX_ROOM_TITLE_LENGTH).transform(s => s.trim()),
  name: z
    .string()
    .min(MIN_DISPLAY_NAME_LENGTH)
    .max(MAX_DISPLAY_NAME_LENGTH)
    .transform(s => s.trim()),
});

export const RoomJoinSchema = z.object({
  code: z.string().length(ROOM_CODE_LENGTH),
  name: z
    .string()
    .min(MIN_DISPLAY_NAME_LENGTH)
    .max(MAX_DISPLAY_NAME_LENGTH)
    .transform(s => s.trim()),
  resumeToken: z.string().optional(),
});

export const OptionAddSchema = z.object({
  title: z.string().min(1).max(MAX_OPTION_TITLE_LENGTH).transform(s => s.trim()),
});

export const OptionRemoveSchema = z.object({
  optionId: z.string(),
});

export const RatingSubmitSchema = z.object({
  optionId: z.string(),
  score: z.number().int().min(RATING_MIN).max(RATING_MAX),
  reason: z
    .string()
    .max(MAX_RATING_REASON_LENGTH)
    .transform(s => s.trim())
    .optional(),
});

export const VoteSetSchema = z.object({
  optionIds: z.array(z.string()),
});

/**
 * Server -> Client events
 */
export const RoomStateSchema = RoomSchema.extend({
  // View-specific fields
  ratingProgress: z
    .object({
      finished: z.number(),
      total: z.number(),
    })
    .optional(),
});

export const AIStatusSchema = z.object({
  line: z.string(),
});

export const ErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

/**
 * AI provider responses
 */
export const AISuggestOptionsResponseSchema = z.object({
  options: z.array(z.string().max(MAX_OPTION_TITLE_LENGTH)).max(3),
});

export const AIAnalyzeResponseSchema = z.object({
  disagreements: z.array(
    z.object({
      optionId: z.string(),
      note: z.string(),
    })
  ),
  compromise: z.object({
    optionId: z.string(),
    rationale: z.string(),
  }),
});

export const AISummaryResponseSchema = z.object({
  summary: z.string().min(50).max(1000),
});
