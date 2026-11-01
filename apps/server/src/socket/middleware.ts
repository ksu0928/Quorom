import type { ExtendedSocket } from './socket-data.js';
import { roomStore } from '../store/room-store.js';
import type { InternalRoom } from '../auth/reconnect.js';

/**
 * Middleware to attach participant identity to socket
 * Must be called after successful join/create
 */
export function attachParticipantIdentity(socket: ExtendedSocket, roomCode: string, participantId: string): void {
  socket.data.roomCode = roomCode;
  socket.data.participantId = participantId;
  socket.join(roomCode); // Join Socket.IO room for broadcasts
}

/**
 * Get the authenticated participant for a socket
 * Returns participantId and room if authenticated, null otherwise
 */
export function getAuthenticatedParticipant(socket: ExtendedSocket): {
  roomCode: string;
  participantId: string;
  room: InternalRoom;
} | null {
  const { roomCode, participantId } = socket.data;

  if (!roomCode || !participantId) {
    return null;
  }

  const room = roomStore.get(roomCode) as InternalRoom | undefined;
  if (!room) {
    return null;
  }

  const participant = room.participants.find((p) => p.id === participantId);
  if (!participant) {
    return null;
  }

  return { roomCode, participantId, room };
}

/**
 * Require authentication for a socket handler
 * Returns authenticated context or sends error and returns null
 */
export function requireAuth(socket: ExtendedSocket): {
  roomCode: string;
  participantId: string;
  room: InternalRoom;
} | null {
  const auth = getAuthenticatedParticipant(socket);
  
  if (!auth) {
    socket.emit('error', {
      code: 'not_authenticated',
      message: 'You must join a room first',
    });
    return null;
  }

  return auth;
}

/**
 * Require the authenticated participant to be the host
 * Returns authenticated context or sends error and returns null
 */
export function requireHost(socket: ExtendedSocket): {
  roomCode: string;
  participantId: string;
  room: InternalRoom;
} | null {
  const auth = requireAuth(socket);
  if (!auth) {
    return null;
  }

  if (auth.participantId !== auth.room.hostId) {
    socket.emit('error', {
      code: 'not_host',
      message: 'Only the host can perform this action',
    });
    return null;
  }

  return auth;
}
