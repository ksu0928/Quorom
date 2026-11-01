import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, RoomState } from '@quorum/shared';
import { roomStore } from '../store/room-store.js';

type TestSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = 'http://localhost:3001';

describe('Integration: Reconnection', () => {
  beforeEach(() => {
    roomStore.clear();
  });

  it('should reconnect participant with valid resumeToken', async () => {
    // Create first client and room
    const client1 = ioClient(SERVER_URL, { transports: ['websocket'] });
    await waitForConnection(client1);

    // Create room
    const createResult = await new Promise<{ code: string; resumeToken: string }>((resolve, reject) => {
      // @ts-ignore - test helper
      client1.emit('room:create', { title: 'Reconnect Test', name: 'Alice' }, (response) => {
        if ('error' in response) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });

    const roomCode = createResult.code;
    const token = createResult.resumeToken;

    // Wait for initial state
    const initialState = await waitForEvent<RoomState>(client1, 'room:state');
    expect(initialState.participants).toHaveLength(1);
    expect(initialState.participants[0].name).toBe('Alice');
    expect(initialState.participants[0].connected).toBe(true);

    // Disconnect
    client1.disconnect();
    await sleep(100);

    // Reconnect with token
    const client2 = ioClient(SERVER_URL, { transports: ['websocket'] });
    await waitForConnection(client2);

    const joinResult = await new Promise<{ resumeToken: string }>((resolve, reject) => {
      // @ts-ignore - test helper
      client2.emit('room:join', { code: roomCode, name: 'Alice', resumeToken: token }, (response: any) => {
        if ('error' in response) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });

    // Should receive the same token back
    expect(joinResult.resumeToken).toBe(token);

    // Get reconnected state
    const reconnectedState = await waitForEvent<RoomState>(client2, 'room:state');
    
    // Should still be 1 participant (not a new one)
    expect(reconnectedState.participants).toHaveLength(1);
    expect(reconnectedState.participants[0].name).toBe('Alice');
    expect(reconnectedState.participants[0].connected).toBe(true);

    client2.disconnect();
  });

  it('should preserve participant identity and ratings after reconnect', async () => {
    // Create room and add options
    const client1 = ioClient(SERVER_URL, { transports: ['websocket'] });
    await waitForConnection(client1);

    const createResult = await new Promise<{ code: string; resumeToken: string }>((resolve, reject) => {
      // @ts-ignore - test helper
      client1.emit('room:create', { title: 'Rating Test', name: 'Alice' }, (response) => {
        if ('error' in response) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });

    const roomCode = createResult.code;
    const token = createResult.resumeToken;

    await waitForEvent<RoomState>(client1, 'room:state');

    // Add second participant
    const client2 = ioClient(SERVER_URL, { transports: ['websocket'] });
    await waitForConnection(client2);

    await new Promise<{ resumeToken: string }>((resolve, reject) => {
      // @ts-ignore - test helper
      client2.emit('room:join', { code: roomCode, name: 'Bob' }, (response) => {
        if ('error' in response) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });

    await waitForEvent<RoomState>(client1, 'room:state');
    await waitForEvent<RoomState>(client2, 'room:state');

    // Advance to options and add options
    client1.emit('phase:advance');
    await waitForEvent<RoomState>(client1, 'room:state');

    client1.emit('option:add', { title: 'Option 1' });
    await waitForEvent<RoomState>(client1, 'room:state');

    client1.emit('option:add', { title: 'Option 2' });
    const optionsState = await waitForEvent<RoomState>(client1, 'room:state');

    const option1Id = optionsState.options[0].id;
    const option2Id = optionsState.options[1].id;

    // Advance to rating
    client1.emit('phase:advance');
    await waitForEvent<RoomState>(client1, 'room:state');
    await waitForEvent<RoomState>(client2, 'room:state');

    // Alice submits ratings
    client1.emit('rating:submit', { optionId: option1Id, score: 5 });
    await waitForEvent<RoomState>(client1, 'room:state');

    client1.emit('rating:submit', { optionId: option2Id, score: 3 });
    const beforeDisconnect = await waitForEvent<RoomState>(client1, 'room:state');

    // Verify Alice has ratings
    const aliceId = beforeDisconnect.participants.find(p => p.name === 'Alice')!.id;
    expect(beforeDisconnect.ratings[aliceId]).toBeDefined();
    expect(beforeDisconnect.ratings[aliceId][option1Id].score).toBe(5);

    // Disconnect Alice
    client1.disconnect();
    await sleep(100);

    // Reconnect Alice
    const client3 = ioClient(SERVER_URL, { transports: ['websocket'] });
    await waitForConnection(client3);

    await new Promise<{ resumeToken: string }>((resolve, reject) => {
      // @ts-ignore - test helper
      client3.emit('room:join', { code: roomCode, name: 'Alice', resumeToken: token }, (response) => {
        if ('error' in response) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });

    const afterReconnect = await waitForEvent<RoomState>(client3, 'room:state');

    // Ratings should still be present
    expect(afterReconnect.ratings[aliceId]).toBeDefined();
    expect(afterReconnect.ratings[aliceId][option1Id].score).toBe(5);
    expect(afterReconnect.ratings[aliceId][option2Id].score).toBe(3);

    // Participant should be marked as connected
    const aliceAfterReconnect = afterReconnect.participants.find(p => p.name === 'Alice')!;
    expect(aliceAfterReconnect.connected).toBe(true);

    client2.disconnect();
    client3.disconnect();
  });

  it('should promote new host after 30 seconds of disconnect', async () => {
    // Create room with host
    const hostClient = ioClient(SERVER_URL, { transports: ['websocket'] });
    await waitForConnection(hostClient);

    const createResult = await new Promise<{ code: string; resumeToken: string }>((resolve, reject) => {
      // @ts-ignore - test helper
      hostClient.emit('room:create', { title: 'Host Promotion Test', name: 'Host' }, (response) => {
        if ('error' in response) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });

    const roomCode = createResult.code;
    const initialState = await waitForEvent<RoomState>(hostClient, 'room:state');
    const originalHostId = initialState.hostId;

    // Add second participant
    const participantClient = ioClient(SERVER_URL, { transports: ['websocket'] });
    await waitForConnection(participantClient);

    await new Promise<{ resumeToken: string }>((resolve, reject) => {
      // @ts-ignore - test helper
      participantClient.emit('room:join', { code: roomCode, name: 'Participant' }, (response) => {
        if ('error' in response) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });

    await waitForEvent<RoomState>(hostClient, 'room:state');
    const stateWithBoth = await waitForEvent<RoomState>(participantClient, 'room:state');

    expect(stateWithBoth.participants).toHaveLength(2);
    expect(stateWithBoth.hostId).toBe(originalHostId);

    // Disconnect host
    hostClient.disconnect();

    // Wait for host promotion (30 seconds + buffer)
    // In test, we'll wait for a state update indicating host change
    await sleep(31000);

    // Trigger a state update to see host promotion
    participantClient.emit('option:add', { title: 'Test Option' });
    const afterPromotionState = await waitForEvent<RoomState>(participantClient, 'room:state');

    // Host should have changed to the participant
    expect(afterPromotionState.hostId).not.toBe(originalHostId);
    const newHost = afterPromotionState.participants.find(p => p.id === afterPromotionState.hostId);
    expect(newHost?.name).toBe('Participant');

    participantClient.disconnect();
  }, 40000); // Extended timeout for this test
});

/**
 * Helper: Wait for socket connection
 */
function waitForConnection(socket: TestSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, 5000);

    socket.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });

    socket.once('connect_error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * Helper: Wait for a specific event
 */
function waitForEvent<T>(socket: TestSocket, event: keyof ServerToClientEvents): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Event ${String(event)} timeout`));
    }, 5000);

    // @ts-ignore - test helper
    socket.once(event, (data) => {
      clearTimeout(timeout);
      resolve(data as T);
    });
  });
}

/**
 * Helper: Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
