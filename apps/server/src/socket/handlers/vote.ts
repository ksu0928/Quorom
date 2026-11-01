import type { Server as SocketIOServer } from 'socket.io';
import {
  ERROR_CODES,
  VoteSetSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type VoteSetPayload,
} from '@quorum/shared';
import type { ExtendedSocket } from '../socket-data.js';
import { roomStore } from '../../store/room-store.js';
import { requireAuth } from '../middleware.js';
import { viewFor } from '../../state/view-filter.js';

/**
 * Handle vote:set event
 */
export function handleVoteSet(
  socket: ExtendedSocket,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  payload: VoteSetPayload
): void {
  const auth = requireAuth(socket);
  if (!auth) return;

  const { room, roomCode, participantId } = auth;

  // Validate phase
  if (room.phase !== 'voting') {
    socket.emit('error', {
      code: ERROR_CODES.INVALID_PHASE,
      message: 'Can only vote in voting phase',
    });
    return;
  }

  // Validate payload
  const validated = VoteSetSchema.safeParse(payload);
  if (!validated.success) {
    socket.emit('error', {
      code: ERROR_CODES.INVALID_INPUT,
      message: 'Invalid vote data',
    });
    return;
  }

  const { optionIds } = validated.data;

  // Verify all option IDs exist
  const validOptionIds = new Set(room.options.map((opt) => opt.id));
  for (const optionId of optionIds) {
    if (!validOptionIds.has(optionId)) {
      socket.emit('error', {
        code: ERROR_CODES.INVALID_INPUT,
        message: 'Invalid option ID in votes',
      });
      return;
    }
  }

  // Verify participant is not AI
  const participant = room.participants.find((p) => p.id === participantId);
  if (participant?.isAI) {
    socket.emit('error', {
      code: ERROR_CODES.INVALID_INPUT,
      message: 'AI participants cannot vote',
    });
    return;
  }

  // Store votes (replacing any previous votes)
  room.votes[participantId] = optionIds;
  room.lastActivity = Date.now();
  roomStore.set(roomCode, room);

  // Broadcast updated state
  broadcastRoomState(io, room, roomCode);
}

/**
 * Broadcast room state to all participants
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
