import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;
const TOKEN_BYTES = 32;

/**
 * Generate a cryptographically random resume token
 * Returns 32 bytes as a hex string (64 characters)
 */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * Hash a token using bcrypt
 * Returns a bcrypt hash that can be safely stored
 */
export async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, SALT_ROUNDS);
}

/**
 * Verify a token against its hash
 * Returns true if the token matches the hash
 */
export async function verifyToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}
