/**
 * Shared constants for Quorum
 */

export const MAX_PARTICIPANTS = 12;
export const MAX_OPTIONS = 10;
export const MAX_ROOM_TITLE_LENGTH = 100;
export const MAX_OPTION_TITLE_LENGTH = 80;
export const MAX_RATING_REASON_LENGTH = 200;
export const MAX_DISPLAY_NAME_LENGTH = 24;
export const MIN_DISPLAY_NAME_LENGTH = 1;
export const MAX_SOCKET_MESSAGE_SIZE = 16 * 1024; // 16 KB

export const ROOM_CODE_LENGTH = 6;
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // Excludes 0, O, 1, I, L

export const ROOM_IDLE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
export const ROOM_SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export const HOST_PROMOTION_DELAY_MS = 30 * 1000; // 30 seconds

export const AI_TIMEOUT_MS = 15 * 1000; // 15 seconds
export const MAX_AI_CALLS_PER_PHASE = 3;

export const ROOM_CREATION_RATE_LIMIT = 10;
export const ROOM_CREATION_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export const PHASES = [
  'lobby',
  'options',
  'rating',
  'revealed',
  'voting',
  'decided',
] as const;

export type PhaseType = (typeof PHASES)[number];

export const RATING_MIN = 1;
export const RATING_MAX = 5;

export const SPREAD_CONTESTED_THRESHOLD = 3;
export const STDDEV_CONTESTED_THRESHOLD = 1.2;
export const MEAN_LOW_THRESHOLD = 2.5;

export const ERROR_CODES = {
  ROOM_NOT_FOUND: 'room_not_found',
  ROOM_FULL: 'room_full',
  ROOM_LOCKED: 'room_locked',
  INVALID_PHASE: 'invalid_phase',
  NOT_HOST: 'not_host',
  INVALID_INPUT: 'invalid_input',
  RATE_LIMITED: 'rate_limited',
  AI_UNAVAILABLE: 'ai_unavailable',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
