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
 */
export function mergeById<T extends { id: string }>(remote: { item: T; pendingWrite: boolean }[], local: T[]): T[] {
  const onScreen = new Map(local.map((x) => [x.id, x] as const));
  return remote.map(({ item, pendingWrite }) => (pendingWrite ? (onScreen.get(item.id) ?? item) : item));
}
