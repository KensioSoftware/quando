/**
 * Generic helpers for lazy sequences. Nothing here knows about intervals.
 *
 * They live apart from the interval algebra because they are not about time at
 * all: one is a way to look at the front of a sequence without consuming it,
 * the other a way to stop consuming one. Both read the same for any element
 * type, and the sweeps next door need exactly one item of lookahead — a sweep
 * that needed more would not be a sweep.
 */

/**
 * `T` excludes `null` and `undefined` deliberately: `peek` uses `undefined` to
 * mean exhausted, so a sequence that could yield `undefined` as a value would
 * be indistinguishable from one that had ended.
 */
export interface Peekable<T extends NonNullable<unknown>> {
  /** The next item without consuming it, or `undefined` once exhausted. */
  readonly peek: () => T | undefined;
  /** Consume the item last peeked, so the next `peek` moves on. */
  readonly drop: () => void;
}

export function peekable<T extends NonNullable<unknown>>(
  source: Iterable<T>,
): Peekable<T> {
  const iterator = source[Symbol.iterator]();
  let buffered: T | undefined;
  let buffering = false;
  let exhausted = false;

  return {
    peek(): T | undefined {
      if (!buffering && !exhausted) {
        const step = iterator.next();
        if (step.done === true) {
          exhausted = true;
        } else {
          buffered = step.value;
          buffering = true;
        }
      }
      return buffering ? buffered : undefined;
    },
    drop(): void {
      buffering = false;
    },
  };
}

/**
 * The first `count` items of a sequence, as an array.
 *
 * The point of it is the stopping: the source may be infinite, and this pulls
 * exactly as far as it needs and no further.
 */
export function take<T>(source: Iterable<T>, count: number): T[] {
  // Rejected before anything is pulled. `NaN` and `Infinity` both fail every
  // comparison that would end the loop, so on an infinite sequence either one
  // hangs rather than returning something wrong — which is worse, and worth an
  // error rather than a silent guess at what was meant.
  if (!Number.isInteger(count)) {
    throw new RangeError(`take() needs a whole number of items, not ${count}.`);
  }

  const taken: T[] = [];
  if (count <= 0) {
    return taken;
  }
  for (const item of source) {
    taken.push(item);
    if (taken.length >= count) {
      break;
    }
  }
  return taken;
}
