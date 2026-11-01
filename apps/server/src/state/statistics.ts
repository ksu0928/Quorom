import {
  MEAN_LOW_THRESHOLD,
  SPREAD_CONTESTED_THRESHOLD,
  STDDEV_CONTESTED_THRESHOLD,
  type Option,
  type Room,
} from '@quorum/shared';

/**
 * Statistics for a single option
 */
export interface OptionStats {
  optionId: string;
  mean: number;
  spread: number;
  stdDev: number;
  ratings: number[];
  verdict: 'consensus' | 'contested' | 'low';
}

/**
 * Compute mean of an array of numbers
 */
function computeMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Compute standard deviation
 */
function computeStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Determine verdict for an option based on statistics
 * Priority: contested first, then low, then consensus
 */
function determineVerdict(mean: number, spread: number, stdDev: number): 'consensus' | 'contested' | 'low' {
  // Check contested first
  if (spread >= SPREAD_CONTESTED_THRESHOLD || stdDev >= STDDEV_CONTESTED_THRESHOLD) {
    return 'contested';
  }
  
  // Then check low
  if (mean < MEAN_LOW_THRESHOLD) {
    return 'low';
  }
  
  // Otherwise consensus
  return 'consensus';
}

/**
 * Compute statistics for a single option
 */
export function computeOptionStats(optionId: string, room: Room): OptionStats {
  const ratings: number[] = [];

  // Collect all ratings for this option (only from human participants)
  for (const participant of room.participants) {
    if (participant.isAI) continue;
    
    const participantRatings = room.ratings[participant.id];
    if (participantRatings && participantRatings[optionId]) {
      ratings.push(participantRatings[optionId].score);
    }
  }

  const mean = computeMean(ratings);
  const spread = ratings.length > 0 ? Math.max(...ratings) - Math.min(...ratings) : 0;
  const stdDev = computeStdDev(ratings, mean);
  const verdict = determineVerdict(mean, spread, stdDev);

  return {
    optionId,
    mean,
    spread,
    stdDev,
    ratings,
    verdict,
  };
}

/**
 * Compute statistics for all options
 */
export function computeStats(room: Room): OptionStats[] {
  return room.options.map((option) => computeOptionStats(option.id, room));
}

/**
 * Find the deterministic compromise option
 * Algorithm:
 * 1. Filter options where no one rated 1
 * 2. Select option with highest mean
 * 3. Tie-break by lowest spread
 * 4. Tie-break by option order
 * 5. If no option qualifies, use highest mean overall
 */
export function findCompromise(stats: OptionStats[], options: Option[]): string {
  // Filter options where no one rated 1
  const eligibleStats = stats.filter((stat) => !stat.ratings.includes(1));

  let candidateStats = eligibleStats.length > 0 ? eligibleStats : stats;

  if (candidateStats.length === 0) {
    // Shouldn't happen, but fallback to first option
    return options[0].id;
  }

  // Find highest mean
  const maxMean = Math.max(...candidateStats.map((s) => s.mean));
  candidateStats = candidateStats.filter((s) => s.mean === maxMean);

  if (candidateStats.length === 1) {
    return candidateStats[0].optionId;
  }

  // Tie-break by lowest spread
  const minSpread = Math.min(...candidateStats.map((s) => s.spread));
  candidateStats = candidateStats.filter((s) => s.spread === minSpread);

  if (candidateStats.length === 1) {
    return candidateStats[0].optionId;
  }

  // Tie-break by option order (earliest wins)
  const optionOrder = new Map(options.map((opt, idx) => [opt.id, idx]));
  candidateStats.sort((a, b) => {
    const orderA = optionOrder.get(a.optionId) ?? Infinity;
    const orderB = optionOrder.get(b.optionId) ?? Infinity;
    return orderA - orderB;
  });

  return candidateStats[0].optionId;
}

/**
 * Tally approval votes
 * Returns the option ID with the strictly highest count
 * If there's a tie, returns all tied option IDs
 */
export interface ApprovalTally {
  winner: string | null;
  tie: string[];
  counts: Record<string, number>;
}

export function tallyApproval(room: Room): ApprovalTally {
  const counts: Record<string, number> = {};

  // Initialize counts
  for (const option of room.options) {
    counts[option.id] = 0;
  }

  // Count votes (only from human participants)
  for (const participant of room.participants) {
    if (participant.isAI) continue;
    
    const votes = room.votes[participant.id];
    if (votes) {
      for (const optionId of votes) {
        if (counts[optionId] !== undefined) {
          counts[optionId]++;
        }
      }
    }
  }

  // Find max count
  const maxCount = Math.max(...Object.values(counts), 0);
  
  if (maxCount === 0) {
    return { winner: null, tie: [], counts };
  }

  // Find all options with max count
  const topOptions = Object.entries(counts)
    .filter(([, count]) => count === maxCount)
    .map(([optionId]) => optionId);

  if (topOptions.length === 1) {
    return { winner: topOptions[0], tie: [], counts };
  } else {
    return { winner: null, tie: topOptions, counts };
  }
}

/**
 * Find participants with highest and lowest ratings for an option
 */
export function findDisagreementParticipants(
  optionId: string,
  room: Room
): { highName: string; lowName: string } | null {
  let highScore = -Infinity;
  let lowScore = Infinity;
  let highName = '';
  let lowName = '';

  for (const participant of room.participants) {
    if (participant.isAI) continue;
    
    const participantRatings = room.ratings[participant.id];
    if (participantRatings && participantRatings[optionId]) {
      const score = participantRatings[optionId].score;
      
      if (score > highScore) {
        highScore = score;
        highName = participant.name;
      }
      if (score < lowScore) {
        lowScore = score;
        lowName = participant.name;
      }
    }
  }

  if (highName && lowName && highName !== lowName) {
    return { highName, lowName };
  }

  return null;
}
