/**
 * Merges a cloud snapshot into the list on screen, one item at a time, by id.
 *
 * Why not just replace the list: a snapshot that fires while this device still has an unconfirmed write for an item shows that item as it
 * was after an EARLIER write. Tick two checklist items quickly and the first write's echo arrives after the second tick; replacing the list
 * with it put the second tick back, and the next tap was built on the stale list, so one tick was lost.
 *
 * Rule: an item the cloud reports as having a pending write FROM THIS DEVICE keeps the version already on screen. Every other item (changes
 * from another device, items confirmed by the server) comes from the snapshot. Items missing from the snapshot are gone (deleted elsewhere).
 * This is per item, so a note edited on a second device still arrives. Skipping whole snapshots with pending writes broke exactly that.
 *
 * `wroteJustNow(id)` covers the instant between this device's write being issued and the cloud flagging it as pending: a snapshot worked out
 * a moment BEFORE the write can still arrive after it, looking confirmed and old. An item this device wrote in the last moment keeps its
 * on-screen version; the cloud's own confirmation of that write arrives right after and settles it.
 */
export function mergeById<T extends { id: string }>(
  remote: { item: T; pendingWrite: boolean }[],
  local: T[],
  wroteJustNow: (id: string) => boolean = () => false
): T[] {
  const onScreen = new Map(local.map((x) => [x.id, x] as const));
  return remote.map(({ item, pendingWrite }) => (pendingWrite || wroteJustNow(item.id) ? (onScreen.get(item.id) ?? item) : item));
}

/** Remembers which items this device wrote in the last `windowMs`, for `mergeById`. */
export const RECENT_WRITE_MS = 750;

export function createRecentWrites(windowMs = RECENT_WRITE_MS, now: () => number = Date.now) {
  const at = new Map<string, number>();
  return {
    note(id: string) {
      at.set(id, now());
      if (at.size > 500) for (const [k, t] of at) if (now() - t > windowMs) at.delete(k);
    },
    wroteJustNow(id: string) {
      const t = at.get(id);
      return t !== undefined && now() - t <= windowMs;
    }
  };
}
