/**
 * How much of a rolling window is already occupied.
 *
 * A cap on the *count* in a window is a depth sweep: each occurrence casts a
 * shadow of fixed width and the answer is where enough of them overlap. A cap
 * on the *time* cannot work that way, because two occurrences of different
 * lengths fill a window by different amounts.
 *
 * What it is instead is a piecewise linear function. Let `f(T)` be the time
 * occupied inside the window ending at `T`. As `T` advances, `f` gains a
 * nanosecond for every nanosecond `T` spends inside an occurrence, and loses
 * one for every nanosecond the far end of the window spends inside one. So the
 * slope is always exactly -1, 0 or +1, and it only changes where an occurrence
 * starts or ends, or where one of those instants plus the window width falls.
 *
 * That is what makes this exact. Between two of those marks the slope is
 * constant and known, so the instant `f` crosses the cap is arithmetic rather
 * than a search. Everything below counts in epoch nanoseconds as `bigint`,
 * because 180 days of them overflows the range a `number` holds exactly.
 */

/** A stretch of time as epoch nanoseconds, which is what the sweep counts in. */
export interface Range {
  readonly start: bigint;
  readonly end: bigint;
}

/**
 * The stretches where the window ending at an instant is already full.
 *
 * `busy` must be sorted and non-overlapping, which is what makes the occupancy
 * of a window the plain sum of the overlaps.
 */
export function overfullWindows(
  busy: readonly Range[],
  cap: bigint,
  width: bigint,
): readonly Range[] {
  const found: Range[] = [];
  const marks = breakpoints(busy, width);

  for (const [index, from] of marks.entries()) {
    const to = marks[index + 1];
    if (to === undefined) {
      break;
    }
    const opens = occupiedAt(busy, from, width);
    const closes = occupiedAt(busy, to, width);
    add(found, crossing(from, to, opens, closes, cap));
  }
  return found;
}

/**
 * The part of one segment that is at or over the cap.
 *
 * The slope is -1, 0 or +1 across the whole segment, so the two ends settle
 * the whole of it. Where one end is over and the other under, the crossing is
 * as far from the over end as the difference between it and the cap.
 */
function crossing(
  from: bigint,
  to: bigint,
  opens: bigint,
  closes: bigint,
  cap: bigint,
): Range | undefined {
  if (opens >= cap) {
    return closes >= cap
      ? { start: from, end: to }
      : { start: from, end: from + (opens - cap) };
  }
  return closes >= cap ? { start: to - (closes - cap), end: to } : undefined;
}

/** Adds a stretch, joining it to the one before where they touch. */
function add(found: Range[], range: Range | undefined): void {
  if (range === undefined || range.end <= range.start) {
    return;
  }
  const last = found.at(-1);
  if (last !== undefined && last.end >= range.start) {
    found[found.length - 1] = { start: last.start, end: range.end };
    return;
  }
  found.push(range);
}

/**
 * The time occupied inside the window ending at an instant.
 *
 * The window is `[at - width, at]`. Both ends are closed here, because an
 * occurrence touching the window at a single instant contributes no time
 * either way and the choice cannot change the total.
 */
function occupiedAt(busy: readonly Range[], at: bigint, width: bigint): bigint {
  const opens = at - width;
  let total = 0n;
  for (const span of busy) {
    const start = span.start > opens ? span.start : opens;
    const end = span.end < at ? span.end : at;
    if (end > start) {
      total += end - start;
    }
  }
  return total;
}

/**
 * Every instant the slope could change at, in order and each one once.
 *
 * An occurrence's own ends are where the near end of the window enters and
 * leaves it. Those same instants plus the width are where the far end does.
 */
function breakpoints(busy: readonly Range[], width: bigint): readonly bigint[] {
  const marks = new Set<bigint>();
  for (const span of busy) {
    marks.add(span.start);
    marks.add(span.end);
    marks.add(span.start + width);
    marks.add(span.end + width);
  }
  return [...marks].toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
