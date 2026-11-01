import { randomBytes } from 'crypto';
import {
  CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_IDLE_TTL_MS,
  ROOM_SWEEP_INTERVAL_MS,
  type Room,
} from '@quorum/shared';

/**
 * In-memory room storage with automatic TTL sweep
 */
export class RoomStore {
  private rooms = new Map<string, Room>();
  private sweepInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startSweep();
  }

  /**
   * Generate a unique 6-character room code
   */
  generateCode(): string {
    let code: string;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      code = this.generateRandomCode();
      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error('Failed to generate unique room code');
      }
    } while (this.rooms.has(code));

    return code;
  }

  private generateRandomCode(): string {
    const bytes = randomBytes(ROOM_CODE_LENGTH);
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      const index = bytes[i] % CODE_ALPHABET.length;
      code += CODE_ALPHABET[index];
    }
    return code;
  }

  /**
   * Store or update a room
   */
  set(code: string, room: Room): void {
    this.rooms.set(code, room);
  }

  /**
   * Retrieve a room by code
   */
  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  /**
   * Delete a room
   */
  delete(code: string): boolean {
    return this.rooms.delete(code);
  }

  /**
   * Check if a room exists
   */
  has(code: string): boolean {
    return this.rooms.has(code);
  }

  /**
   * Get all room codes
   */
  getAllCodes(): string[] {
    return Array.from(this.rooms.keys());
  }

  /**
   * Start the background sweep interval
   */
  private startSweep(): void {
    if (this.sweepInterval) {
      return;
    }

    this.sweepInterval = setInterval(() => {
      this.sweep();
    }, ROOM_SWEEP_INTERVAL_MS);

    // Don't prevent Node from exiting
    this.sweepInterval.unref();
  }

  /**
   * Sweep expired rooms based on TTL
   */
  private sweep(): void {
    const now = Date.now();
    const expiredCodes: string[] = [];

    for (const [code, room] of this.rooms.entries()) {
      const idleTime = now - room.lastActivity;
      if (idleTime >= ROOM_IDLE_TTL_MS) {
        expiredCodes.push(code);
      }
    }

    for (const code of expiredCodes) {
      this.rooms.delete(code);
    }

    if (expiredCodes.length > 0) {
      console.log(`Swept ${expiredCodes.length} expired rooms`);
    }
  }

  /**
   * Stop the sweep interval (for cleanup)
   */
  stopSweep(): void {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
  }

  /**
   * Clear all rooms (for testing)
   */
  clear(): void {
    this.rooms.clear();
  }

  /**
   * Get room count (for testing/monitoring)
   */
  size(): number {
    return this.rooms.size;
  }
}

// Singleton instance
export const roomStore = new RoomStore();
