import type { Server as SocketIOServer } from 'socket.io';
import { randomUUID } from 'crypto';
import {
  ERROR_CODES,
  MAX_OPTIONS,
  OptionAddSchema,
  OptionRemoveSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type OptionAddPayload,
  type OptionRemovePayload,
  type Option,
} from '@quorum/shared';
import type { ExtendedSocket } from '../socket-data.js';
import { roomStore } from '../../store/room-store.js';
import { requireAuth } from '../middleware.js';
import { viewFor } from '../../state/view-filter.js';

/**
 * Handle option:add event
 */
export function handleOptionAdd(
  socket: ExtendedSocket,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  payload: OptionAddPayload
): void {
  const auth = requireAuth(socket);
  if (!auth) return;

  const { room, roomCode, participantId } = auth;

  // Validate phase
  if (room.phase !== 'lobby' && room.phase !== 'options') {
    socket.emit('error', {
      code: ERROR_CODES.INVALID_PHASE,
      message: 'Can only add options in lobby or options phase',
    });
    return;
  }

  // Validate payload
  const validated = OptionAddSchema.safeParse(payload);
  if (!validated.success) {
    socket.emit('error', {
      code: ERROR_CODES.INVALID_INPUT,
      message: 'Invalid option data',
    });
    return;
  }

  const { title } = validated.data;

  // Check max options
  if (room.options.length >= MAX_OPTIONS) {
    socket.emit('error', {
      code: ERROR_CODES.INVALID_INPUT,
      message: `Maximum ${MAX_OPTIONS} options allowed`,
    });
    return;
  }

  // Check for duplicate titles (case-insensitive)
  const titleLower = title.toLowerCase();
  const duplicate = room.options.some((opt) => opt.title.toLowerCase() === titleLower);
  if (duplicate) {
    socket.emit('error', {
      code: ERROR_CODES.INVALID_INPUT,
      message: 'An option with this title already exists',
    });
    return;
  }

  // Add option
  const option: Option = {
    id: randomUUID(),
    title,
    addedBy: participantId,
    suggestedByAI: false,
  };

  room.options.push(option);
  room.lastActivity = Date.now();
  roomStore.set(roomCode, room);

  // Broadcast updated state
  broadcastRoomState(io, room, roomCode);
}

/**
 * Handle option:remove event
 */
export function handleOptionRemove(
  socket: ExtendedSocket,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  payload: OptionRemovePayload
): void {
  const auth = requireAuth(socket);
  if (!auth) return;

  const { room, roomCode } = auth;

  // Validate phase
  if (room.phase !== 'lobby' && room.phase !== 'options') {
    socket.emit('error', {
      code: ERROR_CODES.INVALID_PHASE,
      message: 'Can only remove options in lobby or options phase',
    });
    return;
  }

  // Validate payload
  const validated = OptionRemoveSchema.safeParse(payload);
  if (!validated.success) {
    socket.emit('error', {
      code: ERROR_CODES.INVALID_INPUT,
      message: 'Invalid option ID',
    });
    return;
  }

  const { optionId } = validated.data;

  // Find and remove option
  const index = room.options.findIndex((opt) => opt.id === optionId);
  if (index === -1) {
    socket.emit('error', {
      code: ERROR_CODES.INVALID_INPUT,
      message: 'Option not found',
    });
    return;
  }

  room.options.splice(index, 1);
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
