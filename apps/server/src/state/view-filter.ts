import type { Room, RoomState } from '@quorum/shared';

/**
 * viewFor - The SINGLE source of truth for filtering room data sent to clients
 * 
 * CRITICAL PRIVACY RULE:
 * In phase "rating", only the requesting participant's own ratings are visible.
 * No other participant's scores or reasons may appear anywhere in the payload.
 * 
 * In "revealed" and later phases, all ratings become visible.
 */
export function viewFor(room: Room, participantId: string): RoomState {
  const { phase, ratings, options } = room;

  // Base room state (always visible)
  const view: RoomState = {
    id: room.id,
    title: room.title,
    phase: room.phase,
    hostId: room.hostId,
    participants: room.participants,
    options: room.options,
    ratings: {},
    votes: room.votes,
    analysis: room.analysis,
    summary: room.summary,
    locked: room.locked,
    createdAt: room.createdAt,
    lastActivity: room.lastActivity,
  };

  if (phase === 'rating') {
    // RATING PHASE: Show only this participant's own ratings
    const participantRatings = ratings[participantId];
    if (participantRatings) {
      view.ratings = { [participantId]: participantRatings };
    }

    // Add rating progress (how many participants have finished rating all options)
    const humanParticipants = room.participants.filter((p) => !p.isAI);
    let finishedCount = 0;

    for (const participant of humanParticipants) {
      const pRatings = ratings[participant.id];
      if (!pRatings) continue;

      const ratedOptionIds = Object.keys(pRatings);
      const hasRatedAll = options.every((opt) => ratedOptionIds.includes(opt.id));
      
      if (hasRatedAll) {
        finishedCount++;
      }
    }

    view.ratingProgress = {
      finished: finishedCount,
      total: humanParticipants.length,
    };
  } else if (phase === 'revealed' || phase === 'voting' || phase === 'decided') {
    // REVEALED AND LATER: Show all ratings
    view.ratings = room.ratings;
  } else {
    // LOBBY, OPTIONS: No ratings visible
    view.ratings = {};
  }

  return view;
}
