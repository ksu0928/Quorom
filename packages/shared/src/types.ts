import { z } from 'zod';
import {
  AnalysisSchema,
  CompromiseSchema,
  DisagreementSchema,
  ErrorSchema,
  OptionAddSchema,
  OptionRemoveSchema,
  OptionSchema,
  ParticipantSchema,
  PerOptionAnalysisSchema,
  PhaseSchema,
  RatingSchema,
  RatingSubmitSchema,
  RoomCreateSchema,
  RoomJoinSchema,
  RoomSchema,
  RoomStateSchema,
  VoteSetSchema,
  AIStatusSchema,
  AISuggestOptionsResponseSchema,
  AIAnalyzeResponseSchema,
  AISummaryResponseSchema,
} from './schemas.js';

/**
 * Core domain types
 */
export type Phase = z.infer<typeof PhaseSchema>;
export type Participant = z.infer<typeof ParticipantSchema>;
export type Option = z.infer<typeof OptionSchema>;
export type Rating = z.infer<typeof RatingSchema>;
export type Disagreement = z.infer<typeof DisagreementSchema>;
export type PerOptionAnalysis = z.infer<typeof PerOptionAnalysisSchema>;
export type Compromise = z.infer<typeof CompromiseSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type RoomState = z.infer<typeof RoomStateSchema>;

/**
 * Client -> Server event payloads
 */
export type RoomCreatePayload = z.infer<typeof RoomCreateSchema>;
export type RoomJoinPayload = z.infer<typeof RoomJoinSchema>;
export type OptionAddPayload = z.infer<typeof OptionAddSchema>;
export type OptionRemovePayload = z.infer<typeof OptionRemoveSchema>;
export type RatingSubmitPayload = z.infer<typeof RatingSubmitSchema>;
export type VoteSetPayload = z.infer<typeof VoteSetSchema>;

/**
 * Server -> Client event payloads
 */
export type AIStatus = z.infer<typeof AIStatusSchema>;
export type ErrorPayload = z.infer<typeof ErrorSchema>;

/**
 * AI provider types
 */
export type AISuggestOptionsResponse = z.infer<typeof AISuggestOptionsResponseSchema>;
export type AIAnalyzeResponse = z.infer<typeof AIAnalyzeResponseSchema>;
export type AISummaryResponse = z.infer<typeof AISummaryResponseSchema>;

/**
 * Socket event map for type safety
 */
export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'ai:status': (status: AIStatus) => void;
  error: (error: ErrorPayload) => void;
}

export interface ClientToServerEvents {
  'room:create': (
    payload: RoomCreatePayload,
    ack: (response: { code: string; resumeToken: string; participantId: string } | { error: ErrorPayload }) => void
  ) => void;
  'room:join': (
    payload: RoomJoinPayload,
    ack: (response: { resumeToken: string; participantId: string } | { error: ErrorPayload }) => void
  ) => void;
  'option:add': (payload: OptionAddPayload) => void;
  'option:remove': (payload: OptionRemovePayload) => void;
  'rating:submit': (payload: RatingSubmitPayload) => void;
  'phase:advance': () => void;
  'vote:set': (payload: VoteSetPayload) => void;
  'ai:suggest': () => void;
}

/**
 * Internal server types
 */
export interface StoredParticipant extends Participant {
  resumeTokenHash: string;
  socketId: string | null;
  disconnectedAt: number | null;
}

export interface RoomCreationRecord {
  count: number;
  windowStart: number;
}
