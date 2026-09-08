/**
 * Ordering strings the same way on every machine.
 *
 * `localeCompare` reads the host's collation, so two machines sorting the same
 * operands can order them differently. Swedish sorts `"ö"` after `"z"` and
 * English sorts it before. A canonical form written one way in one place and
 * another way in another is not canonical, and a fingerprint used as a cache
 * key has to survive the trip between them.
 *
 * `toSorted()` with no comparator already orders by code unit. This is for the
 * callers that need a comparator anyway, because they sort by something
 * derived from the element rather than by the element itself.
 */
export function byCodeUnit(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}
