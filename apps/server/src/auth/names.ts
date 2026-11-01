import type { Participant } from '@quorum/shared';

/**
 * Assign a unique display name within a room
 * If the name conflicts, append a numeric suffix (2, 3, 4, ...)
 * 
 * @param desiredName The name the user wants
 * @param existingParticipants Current participants in the room
 * @param excludeParticipantId Optional participant ID to exclude (for reconnection)
 * @returns A unique name
 */
export function assignUniqueName(
  desiredName: string,
  existingParticipants: Participant[],
  excludeParticipantId?: string
): string {
  // Get existing names (excluding the participant being updated)
  const existingNames = existingParticipants
    .filter((p) => p.id !== excludeParticipantId)
    .map((p) => p.name.toLowerCase());

  // Check if the desired name is available
  if (!existingNames.includes(desiredName.toLowerCase())) {
    return desiredName;
  }

  // Find the next available suffix
  let suffix = 2;
  while (existingNames.includes(`${desiredName} ${suffix}`.toLowerCase())) {
    suffix++;
  }

  return `${desiredName} ${suffix}`;
}
