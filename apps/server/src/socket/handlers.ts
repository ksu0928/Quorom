import type { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@quorum/shared';
import type { ExtendedSocket } from './socket-data.js';
import { handleRoomCreate } from './handlers/room-create.js';
import { handleRoomJoin } from './handlers/room-join.js';
import { handleOptionAdd, handleOptionRemove } from './handlers/options.js';
import { handleRatingSubmit } from './handlers/rating.js';
import { handlePhaseAdvance } from './handlers/phase-advance.js';
import { handleVoteSet } from './handlers/vote.js';
import { handleAISuggest } from './handlers/ai-suggest.js';
import { handleDisconnect } from './handlers/disconnect.js';

/**
 * Setup all Socket.IO event handlers
 */
export function setupSocketHandlers(io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>): void {
  io.on('connection', (socket: ExtendedSocket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Room lifecycle
    socket.on('room:create', (payload, ack) => handleRoomCreate(socket, io, payload, ack));
    socket.on('room:join', (payload, ack) => handleRoomJoin(socket, io, payload, ack));

    // Options
    socket.on('option:add', (payload) => handleOptionAdd(socket, io, payload));
    socket.on('option:remove', (payload) => handleOptionRemove(socket, io, payload));

    // Rating
    socket.on('rating:submit', (payload) => handleRatingSubmit(socket, io, payload));

    // Phase transitions
    socket.on('phase:advance', () => handlePhaseAdvance(socket, io));

    // Voting
    socket.on('vote:set', (payload) => handleVoteSet(socket, io, payload));

    // AI
    socket.on('ai:suggest', () => handleAISuggest(socket, io));

    // Disconnect
    socket.on('disconnect', () => handleDisconnect(socket, io));
  });
}
