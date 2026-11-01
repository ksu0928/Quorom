import type { Room } from '@quorum/shared';
import type { StoredParticipant } from '@quorum/shared';
import { verifyToken } from './tokens.js';

/**
 * Extended Room type for internal server use with StoredParticipant
 */
export interface InternalRoom extends Omit<Room, 'participants'> {
  participants: StoredParticipant[];
}

/**
 * Result of attempting to reconnect with a resume token
 */
export interface ReconnectResult {
  success: boolean;
  participantId?: string;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Attempt to reconnect a participant using their resume token
 * 
 * @param room The room to reconnect to
 * @param resumeToken The token provided by the client
 * @returns ReconnectResult with participantId if successful
 */
export async function attemptReconnect(
  room: InternalRoom,
  resumeToken: string
): Promise<ReconnectResult> {
  // Check each participant's token hash
  for (const participant of room.participants) {
    const isValid = await verifyToken(resumeToken, participant.resumeTokenHash);
    
    if (isValid) {
      return {
        success: true,
        participantId: participant.id,
      };
    }
  }

  // No matching token found
  return {
    success: false,
    error: {
      code: 'invalid_token',
      message: 'Resume token is invalid or expired',
    },
  };
}

/**
 * Mark a participant as reconnected
 * Updates their connected status and socket ID
 */
export function markReconnected(
  room: InternalRoom,
  participantId: string,
  socketId: string
): void {
  const participant = room.participants.find((p) => p.id === participantId);
  
  if (participant) {
    participant.connected = true;
    participant.socketId = socketId;
    participant.disconnectedAt = null;
  }
}
