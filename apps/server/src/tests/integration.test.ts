import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, RoomState } from '@quorum/shared';
import { roomStore } from '../store/room-store.js';

type TestSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = 'http://localhost:3001';

describe('Integration: Full Flow (lobby -> decided)', () => {
  let clientA: TestSocket;
  let clientB: TestSocket;
  let roomCode: string;
  let tokenA: string;
  let tokenB: string;

  beforeEach(() => {
    // Clear room store
    roomStore.clear();
  });

  afterEach(() => {
    if (clientA?.connected) clientA.disconnect();
    if (clientB?.connected) clientB.disconnect();
  });

  it('should complete full flow from lobby to decided while maintaining rating privacy', async () => {
    // Create two clients
    clientA = ioClient(SERVER_URL, { transports: ['websocket'] });
    clientB = ioClient(SERVER_URL, { transports: ['websocket'] });

    await waitForConnection(clientA);
    await waitForConnection(clientB);

    // ===== LOBBY PHASE =====
    
    // Client A creates room
    const createResult = await new Promise<{ code: string; resumeToken: string }>((resolve, reject) => {
      clientA.emit('room:create', { title: 'Test Decision', name: 'Alice' }, (response) => {
        if ('error' in response) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });

    roomCode = createResult.code;
    tokenA = createResult.resumeToken;

    expect(roomCode).toHaveLength(6);
    expect(tokenA).toBeTruthy();

    // Wait for room state
    const stateA = await waitForEvent<RoomState>(clientA, 'room:state');
    expect(stateA.phase).toBe('lobby');
    expect(stateA.participants).toHaveLength(1);
    expect(stateA.participants[0].name).toBe('Alice');
    expect(stateA.hostId).toBe(stateA.participants[0].id);

    // Client B joins room
    const joinResult = await new Promise<{ resumeToken: string }>((resolve, reject) => {
      clientB.emit('room:join', { code: roomCode, name: 'Bob' }, (response) => {
        if ('error' in response) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });

    tokenB = joinResult.resumeToken;
    expect(tokenB).toBeTruthy();

    // Both clients should receive updated state
    const stateA2 = await waitForEvent<RoomState>(clientA, 'room:state');
    const stateB = await waitForEvent<RoomState>(clientB, 'room:state');

    expect(stateA2.participants).toHaveLength(2);
    expect(stateB.participants).toHaveLength(2);
    expect(stateB.participants.map(p => p.name)).toContain('Alice');
    expect(stateB.participants.map(p => p.name)).toContain('Bob');

    // ===== OPTIONS PHASE =====

    // Advance to options
    clientA.emit('phase:advance');
    const stateA3 = await waitForEvent<RoomState>(clientA, 'room:state');
    expect(stateA3.phase).toBe('options');

    // Add options
    clientA.emit('option:add', { title: 'Option A' });
    await waitForEvent<RoomState>(clientA, 'room:state');

    clientB.emit('option:add', { title: 'Option B' });
    const stateWithOptions = await waitForEvent<RoomState>(clientA, 'room:state');
    
    expect(stateWithOptions.options).toHaveLength(2);
    const optionAId = stateWithOptions.options.find(o => o.title === 'Option A')!.id;
    const optionBId = stateWithOptions.options.find(o => o.title === 'Option B')!.id;

    // ===== RATING PHASE =====

    // Advance to rating
    clientA.emit('phase:advance');
    const stateRatingA = await waitForEvent<RoomState>(clientA, 'room:state');
    const stateRatingB = await waitForEvent<RoomState>(clientB, 'room:state');

    expect(stateRatingA.phase).toBe('rating');
    expect(stateRatingB.phase).toBe('rating');

    // Client A submits ratings
    clientA.emit('rating:submit', { optionId: optionAId, score: 5, reason: 'Alice loves A' });
    await waitForEvent<RoomState>(clientA, 'room:state');

    clientA.emit('rating:submit', { optionId: optionBId, score: 2, reason: 'Alice dislikes B' });
    await waitForEvent<RoomState>(clientA, 'room:state');

    // Client B submits ratings
    clientB.emit('rating:submit', { optionId: optionAId, score: 3, reason: 'Bob neutral on A' });
    await waitForEvent<RoomState>(clientB, 'room:state');

    clientB.emit('rating:submit', { optionId: optionBId, score: 4, reason: 'Bob likes B' });
    const finalRatingState = await waitForEvent<RoomState>(clientB, 'room:state');

    // ===== CRITICAL PRIVACY TEST =====
    // At this point, Client B should NOT see Client A's ratings
    
    // Get the latest states for both clients
    let privacyTestStateA: RoomState | null = null;
    let privacyTestStateB: RoomState | null = null;

    // Set up listeners for new states
    const stateAPromise = new Promise<RoomState>((resolve) => {
      clientA.once('room:state', resolve);
    });
    const stateBPromise = new Promise<RoomState>((resolve) => {
      clientB.once('room:state', resolve);
    });

    // Trigger a state broadcast by adding a comment (or we can use the states we already have)
    // Use the states we already have from the last rating submission
    privacyTestStateA = stateRatingA; // From when we entered rating phase
    privacyTestStateB = finalRatingState; // From Bob's last rating

    // CLIENT A should only see their own ratings
    expect(privacyTestStateA.ratings).toHaveProperty(stateRatingA.participants[0].id);
    expect(Object.keys(privacyTestStateA.ratings)).toHaveLength(1);

    // CLIENT B should only see their own ratings
    const bobId = stateRatingB.participants.find(p => p.name === 'Bob')!.id;
    expect(privacyTestStateB.ratings).toHaveProperty(bobId);
    expect(Object.keys(privacyTestStateB.ratings)).toHaveLength(1);

    // Serialize and verify no leakage in JSON
    const jsonA = JSON.stringify(privacyTestStateA);
    const jsonB = JSON.stringify(privacyTestStateB);

    // Client A's view should NOT contain Bob's ratings
    expect(jsonA).not.toContain('Bob neutral on A');
    expect(jsonA).not.toContain('Bob likes B');
    expect(jsonA).toContain('Alice loves A');
    expect(jsonA).toContain('Alice dislikes B');

    // Client B's view should NOT contain Alice's ratings
    expect(jsonB).not.toContain('Alice loves A');
    expect(jsonB).not.toContain('Alice dislikes B');
    expect(jsonB).toContain('Bob neutral on A');
    expect(jsonB).toContain('Bob likes B');

    // ===== REVEALED PHASE =====

    // Advance to revealed
    clientA.emit('phase:advance');
    const stateRevealedA = await waitForEvent<RoomState>(clientA, 'room:state');
    const stateRevealedB = await waitForEvent<RoomState>(clientB, 'room:state');

    expect(stateRevealedA.phase).toBe('revealed');
    expect(stateRevealedB.phase).toBe('revealed');

    // NOW both clients should see all ratings
    expect(Object.keys(stateRevealedA.ratings).length).toBeGreaterThan(1);
    expect(Object.keys(stateRevealedB.ratings).length).toBeGreaterThan(1);

    const jsonRevealedA = JSON.stringify(stateRevealedA);
    const jsonRevealedB = JSON.stringify(stateRevealedB);

    // Both should see both participants' ratings
    expect(jsonRevealedA).toContain('Alice loves A');
    expect(jsonRevealedA).toContain('Bob neutral on A');
    expect(jsonRevealedB).toContain('Alice dislikes B');
    expect(jsonRevealedB).toContain('Bob likes B');

    // Analysis should be present (might be deterministic if AI not configured)
    expect(stateRevealedA.analysis).toBeTruthy();
    expect(stateRevealedA.analysis?.perOption).toHaveLength(2);

    // ===== VOTING PHASE =====

    // Advance to voting
    clientA.emit('phase:advance');
    const stateVotingA = await waitForEvent<RoomState>(clientA, 'room:state');
    expect(stateVotingA.phase).toBe('voting');

    // Submit votes
    clientA.emit('vote:set', { optionIds: [optionAId] });
    await waitForEvent<RoomState>(clientA, 'room:state');

    clientB.emit('vote:set', { optionIds: [optionBId] });
    await waitForEvent<RoomState>(clientB, 'room:state');

    // ===== DECIDED PHASE =====

    // Advance to decided
    clientA.emit('phase:advance');
    const stateDecidedA = await waitForEvent<RoomState>(clientA, 'room:state');
    const stateDecidedB = await waitForEvent<RoomState>(clientB, 'room:state');

    expect(stateDecidedA.phase).toBe('decided');
    expect(stateDecidedB.phase).toBe('decided');

    // Summary should be present
    expect(stateDecidedA.summary).toBeTruthy();
    expect(typeof stateDecidedA.summary).toBe('string');
  });
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.once(event, (data: any) => {
      clearTimeout(timeout);
      resolve(data as T);
    });
  });
}
