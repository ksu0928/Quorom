import {
  ERROR_CODES,
  ROOM_CREATION_RATE_LIMIT,
  ROOM_CREATION_RATE_WINDOW_MS,
  type RoomCreationRecord,
} from '@quorum/shared';

/**
 * Track room creation by IP address
 */
const roomCreationByIP = new Map<string, RoomCreationRecord>();

/**
 * Check if IP has exceeded room creation rate limit
 * Returns error object if rate limited, null otherwise
 */
export function checkRoomCreationRateLimit(ip: string): { code: string; message: string } | null {
  const now = Date.now();
  const record = roomCreationByIP.get(ip);

  if (!record) {
    // First room creation from this IP
    roomCreationByIP.set(ip, {
      count: 1,
      windowStart: now,
    });
    return null;
  }

  // Check if window has expired
  if (now - record.windowStart >= ROOM_CREATION_RATE_WINDOW_MS) {
    // Reset window
    roomCreationByIP.set(ip, {
      count: 1,
      windowStart: now,
    });
    return null;
  }

  // Within window - check limit
  if (record.count >= ROOM_CREATION_RATE_LIMIT) {
    return {
      code: ERROR_CODES.RATE_LIMITED,
      message: `Rate limit exceeded. Maximum ${ROOM_CREATION_RATE_LIMIT} rooms per hour.`,
    };
  }

  // Increment count
  record.count++;
  return null;
}

/**
 * Clear rate limit data (for testing)
 */
export function clearRateLimitData(): void {
  roomCreationByIP.clear();
}
