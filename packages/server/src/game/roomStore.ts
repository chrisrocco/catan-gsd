import { RoomSession } from './RoomSession.js';

/** Singleton map of room code → RoomSession. */
export const roomStore = new Map<string, RoomSession>();

/** Returns a Set of all active room codes. */
export function getRoomCodes(): Set<string> {
  return new Set(roomStore.keys());
}

/** Delete all expired sessions and return the count of sessions removed. */
export function cleanExpiredRooms(): number {
  let removed = 0;
  for (const [code, session] of roomStore) {
    if (session.isExpired) {
      roomStore.delete(code);
      removed++;
    }
  }
  return removed;
}
