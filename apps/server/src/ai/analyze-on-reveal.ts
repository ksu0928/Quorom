import type { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@quorum/shared';
import type { InternalRoom } from '../auth/reconnect.js';
import { createAIProvider } from './provider.js';
import { analyzeRoom, writeSummary } from './jobs.js';
import { computeStats } from '../state/statistics.js';
import { createDeterministicAnalysis, createDeterministicSummary, withRetryAndFallback } from './fallback.js';
import { roomStore } from '../store/room-store.js';
import { viewFor } from '../state/view-filter.js';

const aiProvider = createAIProvider();

/**
 * Trigger AI analysis when entering revealed phase
 * This should be called after phase transition to revealed
 */
export async function triggerAnalysisOnReveal(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  room: InternalRoom,
  roomCode: string
): Promise<void> {
  if (room.phase !== 'revealed') {
    return; // Only analyze in revealed phase
  }

  // Compute statistics
  const stats = computeStats(room);

  // If AI is not configured, use deterministic fallback immediately
  if (!aiProvider) {
    room.analysis = createDeterministicAnalysis(room, stats);
    roomStore.set(roomCode, room);
    broadcastRoomState(io, room, roomCode);
    return;
  }

  try {
    // Emit AI status
    io.to(roomCode).emit('ai:status', { line: 'reading ratings' });

    // Analyze with retry and fallback
    const analysis = await withRetryAndFallback(
      () => analyzeRoom(aiProvider!, room, stats),
      () => createDeterministicAnalysis(room, stats),
      'AI analysis'
    );

    room.analysis = analysis;
    roomStore.set(roomCode, room);

    // Clear AI status
    io.to(roomCode).emit('ai:status', { line: '' });

    // Broadcast updated state
    broadcastRoomState(io, room, roomCode);

    console.log(`Analysis completed for room ${roomCode}`);
  } catch (error) {
    console.error('Analysis error:', error);
    
    // Clear AI status
    io.to(roomCode).emit('ai:status', { line: '' });

    // Use deterministic fallback
    room.analysis = createDeterministicAnalysis(room, stats);
    roomStore.set(roomCode, room);
    broadcastRoomState(io, room, roomCode);
  }
}

/**
 * Trigger AI summary when entering decided phase
 * This should be called after phase transition to decided
 */
export async function triggerSummaryOnDecided(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  room: InternalRoom,
  roomCode: string
): Promise<void> {
  if (room.phase !== 'decided') {
    return; // Only summarize in decided phase
  }

  // Compute statistics if not already done
  const stats = computeStats(room);

  // Ensure analysis exists
  if (!room.analysis) {
    room.analysis = createDeterministicAnalysis(room, stats);
  }

  // If AI is not configured, use deterministic fallback immediately
  if (!aiProvider) {
    room.summary = createDeterministicSummary(room, room.analysis);
    roomStore.set(roomCode, room);
    broadcastRoomState(io, room, roomCode);
    return;
  }

  try {
    // Emit AI status
    io.to(roomCode).emit('ai:status', { line: 'writing summary' });

    // Write summary with retry and fallback
    const summary = await withRetryAndFallback(
      () => writeSummary(aiProvider!, room, stats),
      () => createDeterministicSummary(room, room.analysis!),
      'AI summary'
    );

    room.summary = summary;
    roomStore.set(roomCode, room);

    // Clear AI status
    io.to(roomCode).emit('ai:status', { line: '' });

    // Broadcast updated state
    broadcastRoomState(io, room, roomCode);

    console.log(`Summary completed for room ${roomCode}`);
  } catch (error) {
    console.error('Summary error:', error);
    
    // Clear AI status
    io.to(roomCode).emit('ai:status', { line: '' });

    // Use deterministic fallback
    room.summary = createDeterministicSummary(room, room.analysis);
    roomStore.set(roomCode, room);
    broadcastRoomState(io, room, roomCode);
  }
}

/**
 * Broadcast room state to all participants
 */
function broadcastRoomState(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  room: InternalRoom,
  roomCode: string
): void {
  for (const participant of room.participants) {
    if (participant.socketId) {
      const view = viewFor(room, participant.id);
      io.to(participant.socketId).emit('room:state', view);
    }
  }
}
