import type { Server as SocketIOServer } from 'socket.io';
import { randomUUID } from 'crypto';
import {
  ERROR_CODES,
  MAX_PARTICIPANTS,
  RoomJoinSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type RoomJoinPayload,
} from '@quorum/shared';
import type { ExtendedSocket } from '../socket-data.js';
import { roomStore } from '../../store/room-store.js';
import { generateToken, hashToken } from '../../auth/tokens.js';
import { assignUniqueName } from '../../auth/names.js';
import { attemptReconnect, markReconnected, type InternalRoom } from '../../auth/reconnect.js';
import { attachParticipantIdentity } from '../middleware.js';
import { viewFor } from '../../state/view-filter.js';
import { cancelHostPromotion } from '../../auth/host-promotion.js';
import type { StoredParticipant } from '@quorum/shared';

/**
 * Handle room:join event
 */
export async function handleRoomJoin(
  socket: ExtendedSocket,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  payload: RoomJoinPayload,
  ack: (response: { resumeToken: string; participantId: string } | { error: { code: string; message: string } }) => void
): Promise<void> {
  try {
    // Validate payload
    const validated = RoomJoinSchema.safeParse(payload);
    if (!validated.success) {
      ack({
        error: {
          code: ERROR_CODES.INVALID_INPUT,
          message: 'Invalid join data',
        },
      });
      return;
    }

    const { code, name, resumeToken } = validated.data;

    // Get room
    const room = roomStore.get(code) as InternalRoom | undefined;
    if (!room) {
      ack({
        error: {
          code: ERROR_CODES.ROOM_NOT_FOUND,
          message: 'Room not found',
        },
      });
      return;
    }

    // Check if room is locked
    if (room.locked) {
      ack({
        error: {
          code: ERROR_CODES.ROOM_LOCKED,
          message: 'Room is locked',
        },
      });
      return;
    }

    // Check if trying to join decided room as new participant
    if (room.phase === 'decided' && !resumeToken) {
      ack({
        error: {
          code: ERROR_CODES.INVALID_PHASE,
          message: 'Cannot join a room in decided phase',
        },
      });
      return;
    }

    let participantId: string;
    let newResumeToken: string;

    // Attempt reconnection if token provided
    if (resumeToken) {
      const reconnect = await attemptReconnect(room, resumeToken);
      
      if (reconnect.success && reconnect.participantId) {
        participantId = reconnect.participantId;
        newResumeToken = resumeToken; // Reuse existing token
        
        // Mark as reconnected
        markReconnected(room, participantId, socket.id);
        
        // Cancel host promotion if this was the host
        if (participantId === room.hostId) {
          cancelHostPromotion(code);
        }
        
        console.log(`Participant reconnected: ${participantId} in room ${code}`);
      } else {
        // Invalid token, treat as new join
        participantId = await createNewParticipant(room, socket.id, name);
        newResumeToken = generateToken();
        const hash = await hashToken(newResumeToken);
        const participant = room.participants.find((p) => p.id === participantId);
        if (participant) {
          participant.resumeTokenHash = hash;
        }
      }
    } else {
      // New participant
      participantId = await createNewParticipant(room, socket.id, name);
      newResumeToken = generateToken();
      const hash = await hashToken(newResumeToken);
      const participant = room.participants.find((p) => p.id === participantId);
      if (participant) {
        participant.resumeTokenHash = hash;
      }
    }

    // Update room activity
    room.lastActivity = Date.now();
    roomStore.set(code, room);

    // Attach identity to socket
    attachParticipantIdentity(socket, code, participantId);

    // Send acknowledgement
    ack({ resumeToken: newResumeToken, participantId });

    // Broadcast updated state on the next tick so clients can register
    // their room:state listeners after the ack resolves
    setImmediate(() => broadcastRoomState(io, room, code));

    console.log(`Participant joined: ${participantId} in room ${code}`);
  } catch (error) {
    console.error('Error joining room:', error);
    ack({
      error: {
        code: ERROR_CODES.INVALID_INPUT,
        message: 'Failed to join room',
      },
    });
  }
}

/**
 * Create a new participant in the room
 */
async function createNewParticipant(
  room: InternalRoom,
  socketId: string,
  desiredName: string
): Promise<string> {
  // Check room capacity
  const humanCount = room.participants.filter((p) => !p.isAI).length;
  if (humanCount >= MAX_PARTICIPANTS) {
    throw new Error('Room is full');
  }

  const participantId = randomUUID();
  const uniqueName = assignUniqueName(desiredName, room.participants);
  const now = Date.now();

  const participant: StoredParticipant = {
    id: participantId,
    name: uniqueName,
    connected: true,
    isAI: false,
    joinedAt: now,
    resumeTokenHash: '', // Will be set by caller
    socketId,
    disconnectedAt: null,
  };

  room.participants.push(participant);
  return participantId;
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
