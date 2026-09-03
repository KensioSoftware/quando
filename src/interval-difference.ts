/** Set difference over interval streams. */

import {
  complement,
  intersect,
  type IntervalStream,
} from "./interval-stream.js";

/** The times the left stream covers and the right stream does not. */
export function difference(
  left: IntervalStream,
  right: IntervalStream,
): IntervalStream {
  return intersect(left, complement(right));
}
