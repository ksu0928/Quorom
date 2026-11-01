import type { Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@quorum/shared';

/**
 * Extended socket type with custom data
 */
export type ExtendedSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  data: {
    roomCode?: string;
    participantId?: string;
  };
};

/**
 * Get the real client IP address (supports proxy headers)
 */
export function getClientIP(socket: ExtendedSocket): string {
  // Check x-forwarded-for header (when behind proxy)
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (forwarded) {
    // Take the first IP if multiple are present
    const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
    return ips[0].trim();
  }
  
  // Fallback to direct connection address
  return socket.handshake.address;
}
