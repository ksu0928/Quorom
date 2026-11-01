import type { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@quorum/shared';
import type { ExtendedSocket } from '../socket-data.js';
import { roomStore } from '../../store/room-store.js';
import { requireHost } from '../middleware.js';
import { canTransition, getNextPhase } from '../../state/transitions.js';
import { viewFor } from '../../state/view-filter.js';
import { triggerAnalysisOnReveal, triggerSummaryOnDecided } from '../../ai/analyze-on-reveal.js';

/**
 * Handle phase:advance event
 * Only the host can advance phases
 */
export async function handlePhaseAdvance(
  socket: ExtendedSocket,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>
): Promise<void> {
  const auth = requireHost(socket);
  if (!auth) return;

  const { room, roomCode } = auth;

  // Check if transition is valid
  const transitionResult = canTransition(room);
  
  if (!transitionResult.success) {
    socket.emit('error', transitionResult.error);
    return;
  }

  // Get next phase
  const nextPhase = getNextPhase(room.phase);
  if (!nextPhase) {
    socket.emit('error', {
      code: 'invalid_phase',
      message: 'Cannot advance from final phase',
    });
    return;
  }

  // Advance phase
  room.phase = nextPhase;
  room.lastActivity = Date.now();
  roomStore.set(roomCode, room);

  console.log(`Room ${roomCode} advanced to phase: ${nextPhase}`);

  // Broadcast updated state
  broadcastRoomState(io, room, roomCode);

  // Trigger AI jobs based on phase
  if (nextPhase === 'revealed') {
    // Background job - don't await
    triggerAnalysisOnReveal(io, room, roomCode).catch((error: unknown) => {
      console.error('Analysis trigger error:', error);
    });
  } else if (nextPhase === 'decided') {
    // Background job - don't await
    triggerSummaryOnDecided(io, room, roomCode).catch((error: unknown) => {
      console.error('Summary trigger error:', error);
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
