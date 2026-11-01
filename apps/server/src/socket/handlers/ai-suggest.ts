import type { Server as SocketIOServer } from 'socket.io';
import { randomUUID } from 'crypto';
import {
  ERROR_CODES,
  MAX_AI_CALLS_PER_PHASE,
  MAX_OPTIONS,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type Option,
} from '@quorum/shared';
import type { ExtendedSocket } from '../socket-data.js';
import { requireAuth } from '../middleware.js';
import { createAIProvider } from '../../ai/provider.js';
import { suggestOptions } from '../../ai/jobs.js';
import { roomStore } from '../../store/room-store.js';
import { viewFor } from '../../state/view-filter.js';
import { checkAICallLimit, incrementAICallCount } from '../../ai/ai-rate-limit.js';

const aiProvider = createAIProvider();

/**
 * Handle ai:suggest event
 */
export async function handleAISuggest(
  socket: ExtendedSocket,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>
): Promise<void> {
  const auth = requireAuth(socket);
  if (!auth) return;

  const { room, roomCode, participantId } = auth;

  // Validate phase
  if (room.phase !== 'options') {
    socket.emit('error', {
      code: ERROR_CODES.INVALID_PHASE,
      message: 'AI suggestions only available in options phase',
    });
    return;
  }

  // Check if AI is configured
  if (!aiProvider) {
    socket.emit('error', {
      code: ERROR_CODES.AI_UNAVAILABLE,
      message: 'AI service is not configured',
    });
    return;
  }

  // Check AI call rate limit
  const rateLimitError = checkAICallLimit(roomCode, room.phase);
  if (rateLimitError) {
    socket.emit('error', rateLimitError);
    return;
  }

  // Check if room has space for more options
  if (room.options.length >= MAX_OPTIONS) {
    socket.emit('error', {
      code: ERROR_CODES.INVALID_INPUT,
      message: `Maximum ${MAX_OPTIONS} options already reached`,
    });
    return;
  }

  try {
    // Emit status
    io.to(roomCode).emit('ai:status', { line: 'suggesting options' });

    // Call AI service
    const suggestions = await suggestOptions(aiProvider, room.title, room.options);

    // Add AI participant if not present
    let aiParticipant = room.participants.find((p) => p.isAI);
    if (!aiParticipant) {
      aiParticipant = {
        id: randomUUID(),
        name: 'AI Assistant',
        connected: true,
        isAI: true,
        joinedAt: Date.now(),
        resumeTokenHash: '',
        socketId: null,
        disconnectedAt: null,
      };
      room.participants.push(aiParticipant);
    }

    // Add suggested options (up to room limit)
    const remainingSpace = MAX_OPTIONS - room.options.length;
    const optionsToAdd = suggestions.slice(0, remainingSpace);

    for (const title of optionsToAdd) {
      const option: Option = {
        id: randomUUID(),
        title,
        addedBy: aiParticipant.id,
        suggestedByAI: true,
      };
      room.options.push(option);
    }

    // Increment AI call count
    incrementAICallCount(roomCode, room.phase);

    room.lastActivity = Date.now();
    roomStore.set(roomCode, room);

    // Clear AI status
    io.to(roomCode).emit('ai:status', { line: '' });

    // Broadcast updated state
    broadcastRoomState(io, room, roomCode);

    console.log(`AI suggested ${optionsToAdd.length} options for room ${roomCode}`);
  } catch (error) {
    console.error('AI suggestion error:', error);
    
    // Clear AI status
    io.to(roomCode).emit('ai:status', { line: '' });

    socket.emit('error', {
      code: ERROR_CODES.AI_UNAVAILABLE,
      message: 'Failed to generate AI suggestions',
    });
  }
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
