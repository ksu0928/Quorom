import type { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@quorum/shared';
import type { ExtendedSocket } from '../socket-data.js';
import { roomStore } from '../../store/room-store.js';
import { getAuthenticatedParticipant } from '../middleware.js';
import { scheduleHostPromotion } from '../../auth/host-promotion.js';
import { viewFor } from '../../state/view-filter.js';
import type { InternalRoom } from '../../auth/reconnect.js';

/**
 * Handle socket disconnect event
 */
export function handleDisconnect(
  socket: ExtendedSocket,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>
): void {
  const auth = getAuthenticatedParticipant(socket);
  if (!auth) {
    console.log(`Socket disconnected (unauthenticated): ${socket.id}`);
    return;
  }

  const { roomCode, participantId, room } = auth;

  // Find participant
  const participant = room.participants.find((p) => p.id === participantId);
  if (!participant) {
    return;
  }

  // Mark as disconnected
  participant.connected = false;
  participant.socketId = null;
  participant.disconnectedAt = Date.now();

  room.lastActivity = Date.now();
  roomStore.set(roomCode, room);

  console.log(`Participant disconnected: ${participantId} from room ${roomCode}`);

  // If this was the host, schedule promotion
  if (participantId === room.hostId) {
    scheduleHostPromotion(
      roomCode,
      () => roomStore.get(roomCode) as InternalRoom | undefined,
      (newHostId) => {
        console.log(`Host promoted in room ${roomCode}: ${newHostId}`);
        broadcastRoomState(io, room, roomCode);
      }
    );
  }

  // Broadcast updated state
  broadcastRoomState(io, room, roomCode);
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
