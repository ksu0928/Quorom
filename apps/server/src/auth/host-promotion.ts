import { HOST_PROMOTION_DELAY_MS } from '@quorum/shared';
import type { InternalRoom } from './reconnect.js';

/**
 * Map of room codes to host promotion timeouts
 */
const promotionTimeouts = new Map<string, NodeJS.Timeout>();

/**
 * Schedule host promotion if the current host has been disconnected
 * Promotes the longest-present connected human participant after 30 seconds
 * 
 * @param roomCode The room code
 * @param getRoom Function to retrieve the current room state
 * @param onPromote Callback when promotion occurs (for broadcasting state)
 */
export function scheduleHostPromotion(
  roomCode: string,
  getRoom: () => InternalRoom | undefined,
  onPromote: (newHostId: string) => void
): void {
  // Clear any existing timeout for this room
  const existingTimeout = promotionTimeouts.get(roomCode);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  // Schedule promotion check
  const timeout = setTimeout(() => {
    const room = getRoom();
    if (!room) {
      promotionTimeouts.delete(roomCode);
      return;
    }

    const currentHost = room.participants.find((p) => p.id === room.hostId);
    
    // Only promote if host is still disconnected
    if (!currentHost || !currentHost.connected) {
      const newHostId = selectNewHost(room);
      
      if (newHostId && newHostId !== room.hostId) {
        room.hostId = newHostId;
        onPromote(newHostId);
      }
    }

    promotionTimeouts.delete(roomCode);
  }, HOST_PROMOTION_DELAY_MS);

  promotionTimeouts.set(roomCode, timeout);
}

/**
 * Cancel a scheduled host promotion (e.g., if host reconnects)
 */
export function cancelHostPromotion(roomCode: string): void {
  const timeout = promotionTimeouts.get(roomCode);
  if (timeout) {
    clearTimeout(timeout);
    promotionTimeouts.delete(roomCode);
  }
}

/**
 * Select a new host from connected human participants
 * Returns the longest-present connected human, or null if none available
 */
function selectNewHost(room: InternalRoom): string | null {
  // Filter to connected human participants
  const candidates = room.participants.filter((p) => p.connected && !p.isAI);

  if (candidates.length === 0) {
    return null;
  }

  // Sort by joinedAt (earliest first)
  candidates.sort((a, b) => a.joinedAt - b.joinedAt);

  return candidates[0].id;
}

/**
 * Clear all promotion timeouts (for cleanup/testing)
 */
export function clearAllPromotionTimeouts(): void {
  for (const timeout of promotionTimeouts.values()) {
    clearTimeout(timeout);
  }
  promotionTimeouts.clear();
}
