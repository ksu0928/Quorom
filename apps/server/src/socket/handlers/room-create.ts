import type { Server as SocketIOServer } from 'socket.io';
import { randomUUID } from 'crypto';
import {
  ERROR_CODES,
  RoomCreateSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type RoomCreatePayload,
} from '@quorum/shared';
import type { ExtendedSocket } from '../socket-data.js';
import { roomStore } from '../../store/room-store.js';
import { generateToken, hashToken } from '../../auth/tokens.js';
import { assignUniqueName } from '../../auth/names.js';
import { attachParticipantIdentity } from '../middleware.js';
import { viewFor } from '../../state/view-filter.js';
import type { InternalRoom } from '../../auth/reconnect.js';
import type { StoredParticipant } from '@quorum/shared';
import { checkRoomCreationRateLimit } from '../../limits/rate-limit.js';
import { getClientIP } from '../socket-data.js';

/**
 * Handle room:create event
 */
export async function handleRoomCreate(
  socket: ExtendedSocket,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  payload: RoomCreatePayload,
  ack: (response: { code: string; resumeToken: string; participantId: string } | { error: { code: string; message: string } }) => void
): Promise<void> {
  try {
    // Check rate limit
    const clientIP = getClientIP(socket);
    const rateLimitError = checkRoomCreationRateLimit(clientIP);
    if (rateLimitError) {
      ack({ error: rateLimitError });
      return;
    }

    // Validate payload
    const validated = RoomCreateSchema.safeParse(payload);
    if (!validated.success) {
      ack({
        error: {
          code: ERROR_CODES.INVALID_INPUT,
          message: 'Invalid room creation data',
        },
      });
      return;
    }

    const { title, name } = validated.data;

    // Generate room code and IDs
    const roomCode = roomStore.generateCode();
    const hostId = randomUUID();
    const resumeToken = generateToken();
    const resumeTokenHash = await hashToken(resumeToken);

    const now = Date.now();

    // Create host participant
    const host: StoredParticipant = {
      id: hostId,
      name: name,
      connected: true,
      isAI: false,
      joinedAt: now,
      resumeTokenHash,
      socketId: socket.id,
      disconnectedAt: null,
    };

    // Create room
    const room: InternalRoom = {
      id: roomCode,
      title,
      phase: 'lobby',
      hostId,
      participants: [host],
      options: [],
      ratings: {},
      votes: {},
      analysis: null,
      summary: null,
      locked: false,
      createdAt: now,
      lastActivity: now,
    };

    // Store room
    roomStore.set(roomCode, room);

    // Attach identity to socket
    attachParticipantIdentity(socket, roomCode, hostId);

    // Send acknowledgement with code and token
    ack({ code: roomCode, resumeToken, participantId: hostId });

    // Send initial room state on the next tick so the client can register
    // its room:state listener after the ack resolves
    setImmediate(() => {
      const view = viewFor(room, hostId);
      socket.emit('room:state', view);
    });

    console.log(`Room created: ${roomCode} by ${name}`);
  } catch (error) {
    console.error('Error creating room:', error);
    ack({
      error: {
        code: ERROR_CODES.INVALID_INPUT,
        message: 'Failed to create room',
      },
    });
  }
}
