import type { Analysis } from '@quorum/shared';
import type { InternalRoom } from '../auth/reconnect.js';
import type { OptionStats } from '../state/statistics.js';
import { findCompromise, findDisagreementParticipants } from '../state/statistics.js';

/**
 * Create deterministic analysis when AI is unavailable or fails
 * Uses pure statistical functions with no AI involvement
 */
export function createDeterministicAnalysis(
  room: InternalRoom,
  stats: OptionStats[]
): Analysis {
  // Use deterministic compromise selection
  const compromiseOptionId = findCompromise(stats, room.options);

  // Find contested options (spread >= 3 or verdict contested)
  const contestedStats = stats.filter((s) => s.verdict === 'contested');

  // Build disagreements for contested options
  const disagreements = contestedStats
    .map((stat) => {
      const participants = findDisagreementParticipants(stat.optionId, room);
      if (participants) {
        return {
          optionId: stat.optionId,
          highName: participants.highName,
          lowName: participants.lowName,
          note: `Disagreement detected (spread: ${stat.spread})`,
        };
      }
      return null;
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .slice(0, 3); // Limit to 3

  // Build perOption from stats
  const perOption = stats.map((stat) => ({
    optionId: stat.optionId,
    mean: stat.mean,
    spread: stat.spread,
    verdict: stat.verdict,
  }));

  return {
    perOption,
    disagreements,
    compromise: {
      optionId: compromiseOptionId,
      rationale: 'Selected based on highest mean rating and lowest spread',
    },
    aiUnavailable: true,
  };
}

/**
 * Create deterministic summary when AI is unavailable or fails
 */
export function createDeterministicSummary(
  room: InternalRoom,
  analysis: Analysis
): string {
  const compromiseOption = room.options.find(
    (opt) => opt.id === analysis.compromise.optionId
  );
  const compromiseTitle = compromiseOption ? compromiseOption.title : 'Unknown option';

  const contestedCount = analysis.perOption.filter((p) => p.verdict === 'contested').length;
  const lowCount = analysis.perOption.filter((p) => p.verdict === 'low').length;
  const consensusCount = analysis.perOption.filter((p) => p.verdict === 'consensus').length;

  let summary = `The group evaluated ${room.options.length} option${room.options.length > 1 ? 's' : ''} `;
  summary += `for the decision: "${room.title}". `;

  summary += `After rating and voting, "${compromiseTitle}" emerged as the recommended choice. `;

  if (contestedCount > 0) {
    summary += `There ${contestedCount === 1 ? 'was' : 'were'} ${contestedCount} contested option${contestedCount > 1 ? 's' : ''} with significant disagreement. `;
  }

  if (consensusCount > 0) {
    summary += `${consensusCount} option${consensusCount > 1 ? 's' : ''} reached consensus among participants. `;
  }

  if (analysis.disagreements.length > 0) {
    summary += `Key disagreements were identified and considered in the final decision.`;
  } else {
    summary += `The decision process was collaborative and reached agreement.`;
  }

  return summary;
}

/**
 * Retry an async operation with fallback
 * Attempts the operation, retries once on failure, then falls back
 */
export async function withRetryAndFallback<T>(
  operation: () => Promise<T>,
  fallback: () => T,
  operationName: string
): Promise<T> {
  try {
    // First attempt
    return await operation();
  } catch (firstError) {
    console.warn(`${operationName} failed (first attempt):`, firstError);

    try {
      // Retry once
      return await operation();
    } catch (secondError) {
      console.warn(`${operationName} failed (retry):`, secondError);
      console.log(`${operationName}: Using deterministic fallback`);
      
      // Fall back to deterministic version
      return fallback();
    }
  }
}
