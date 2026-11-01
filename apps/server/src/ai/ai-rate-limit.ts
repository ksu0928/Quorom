import { ERROR_CODES, MAX_AI_CALLS_PER_PHASE, type Phase } from '@quorum/shared';

/**
 * Track AI calls per room per phase
 * Key format: "roomCode:phase"
 */
const aiCallCounts = new Map<string, number>();

/**
 * Generate key for AI call tracking
 */
function getAICallKey(roomCode: string, phase: Phase): string {
  return `${roomCode}:${phase}`;
}

/**
 * Check if room has exceeded AI call limit for current phase
 * Returns error object if rate limited, null otherwise
 */
export function checkAICallLimit(
  roomCode: string,
  phase: Phase
): { code: string; message: string } | null {
  const key = getAICallKey(roomCode, phase);
  const count = aiCallCounts.get(key) || 0;

  if (count >= MAX_AI_CALLS_PER_PHASE) {
    return {
      code: ERROR_CODES.RATE_LIMITED,
      message: `AI call limit reached (${MAX_AI_CALLS_PER_PHASE} per phase)`,
    };
  }

  return null;
}

/**
 * Increment AI call count for room and phase
 */
export function incrementAICallCount(roomCode: string, phase: Phase): void {
  const key = getAICallKey(roomCode, phase);
  const count = aiCallCounts.get(key) || 0;
  aiCallCounts.set(key, count + 1);
}

/**
 * Clear AI call tracking data (for testing)
 */
export function clearAICallData(): void {
  aiCallCounts.clear();
}

/**
 * Get current AI call count for a room and phase (for testing/monitoring)
 */
export function getAICallCount(roomCode: string, phase: Phase): number {
  const key = getAICallKey(roomCode, phase);
  return aiCallCounts.get(key) || 0;
}
