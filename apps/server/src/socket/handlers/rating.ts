import type { Server as SocketIOServer } from 'socket.io';
import {
  ERROR_CODES,
  RatingSubmitSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type RatingSubmitPayload,
} from '@quorum/shared';
import type { ExtendedSocket } from '../socket-data.js';
import { roomStore } from '../../store/room-store.js';
import { requireAuth } from '../middleware.js';
import { viewFor } from '../../state/view-filter.js';

/**
 * Handle rating:submit event
 */
export function handleRatingSubmit(
  socket: ExtendedSocket,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  payload: RatingSubmitPayload
): void {
  const auth = requireAuth(socket);
  if (!auth) return;

  const { room, roomCode, participantId } = auth;

  // Validate phase
  if (room.phase !== 'rating') {
    socket.emit('error', {
      code: ERROR_CODES.INVALID_PHASE,
      message: 'Can only submit ratings in rating phase',
    });
    return;
  }

  // Validate payload
  const validated = RatingSubmitSchema.safeParse(payload);
  if (!validated.success) {
    socket.emit('error', {
      code: ERROR_CODES.INVALID_INPUT,
      message: 'Invalid rating data',
    });
    return;
  }

  const { optionId, score, reason } = validated.data;

  // Verify option exists
  const optionExists = room.options.some((opt) => opt.id === optionId);
  if (!optionExists) {
    socket.emit('error', {
      code: ERROR_CODES.INVALID_INPUT,
      message: 'Option not found',
    });
    return;
  }

  // Verify participant is not AI
  const participant = room.participants.find((p) => p.id === participantId);
  if (participant?.isAI) {
    socket.emit('error', {
      code: ERROR_CODES.INVALID_INPUT,
      message: 'AI participants cannot submit ratings',
    });
    return;
  }

  // Initialize ratings structure if needed
  if (!room.ratings[participantId]) {
    room.ratings[participantId] = {};
  }

  // Store rating
  room.ratings[participantId][optionId] = {
    score,
    reason,
  };

  room.lastActivity = Date.now();
  roomStore.set(roomCode, room);

  // Broadcast updated state (viewFor ensures privacy)
  broadcastRoomState(io, room, roomCode);
}

/**
 * Broadcast room state to all participants
 * Privacy is enforced by viewFor function
 */
function broadcastRoomState(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  room: any,
  roomCode: string
): void {
  for (const participant of room.participants) {
    if (participant.socketId) {
      const view = viewFor(room, participant.id);
      io.to(participant.socketId).emit('room:state', view);
    }
  }
}
