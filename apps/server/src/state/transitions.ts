import { ERROR_CODES, type Phase, type Room } from '@quorum/shared';

/**
 * Error returned when a phase transition is invalid
 */
export interface TransitionError {
  code: string;
  message: string;
}

/**
 * Result of attempting a phase transition
 */
export type TransitionResult =
  | { success: true }
  | { success: false; error: TransitionError };

/**
 * Count human participants (non-AI)
 */
function countHumanParticipants(room: Room): number {
  return room.participants.filter((p) => !p.isAI).length;
}

/**
 * Validate transition from lobby to options
 * Requirements: at least 1 human participant
 */
function canTransitionLobbyToOptions(room: Room): TransitionResult {
  const humanCount = countHumanParticipants(room);
  
  if (humanCount < 1) {
    return {
      success: false,
      error: {
        code: ERROR_CODES.INVALID_PHASE,
        message: 'At least 1 human participant required to advance from lobby',
      },
    };
  }

  return { success: true };
}

/**
 * Validate transition from options to rating
 * Requirements: at least 2 options
 */
function canTransitionOptionsToRating(room: Room): TransitionResult {
  if (room.options.length < 2) {
    return {
      success: false,
      error: {
        code: ERROR_CODES.INVALID_PHASE,
        message: 'At least 2 options required to advance to rating',
      },
    };
  }

  return { success: true };
}

/**
 * Validate transition from rating to revealed
 * Host only, no additional requirements
 */
function canTransitionRatingToRevealed(): TransitionResult {
  return { success: true };
}

/**
 * Validate transition from revealed to voting
 * Host only, no additional requirements
 */
function canTransitionRevealedToVoting(): TransitionResult {
  return { success: true };
}

/**
 * Validate transition from voting to decided
 * Host only, no additional requirements
 */
function canTransitionVotingToDecided(): TransitionResult {
  return { success: true };
}

/**
 * Phase transition map
 */
const TRANSITIONS: Record<Phase, Phase | null> = {
  lobby: 'options',
  options: 'rating',
  rating: 'revealed',
  revealed: 'voting',
  voting: 'decided',
  decided: null,
};

/**
 * Validation functions for each transition
 */
const VALIDATORS: Record<Phase, ((room: Room) => TransitionResult) | null> = {
  lobby: canTransitionLobbyToOptions,
  options: canTransitionOptionsToRating,
  rating: canTransitionRatingToRevealed,
  revealed: canTransitionRevealedToVoting,
  voting: canTransitionVotingToDecided,
  decided: null,
};

/**
 * Check if a phase transition is valid
 * Returns success: true if valid, or success: false with error details
 */
export function canTransition(room: Room): TransitionResult {
  const currentPhase = room.phase;
  const nextPhase = TRANSITIONS[currentPhase];

  if (!nextPhase) {
    return {
      success: false,
      error: {
        code: ERROR_CODES.INVALID_PHASE,
        message: `Cannot advance from ${currentPhase} - already in final phase`,
      },
    };
  }

  const validator = VALIDATORS[currentPhase];
  if (!validator) {
    return { success: true };
  }

  return validator(room);
}

/**
 * Get the next phase for a given phase (without validation)
 */
export function getNextPhase(phase: Phase): Phase | null {
  return TRANSITIONS[phase];
}
