/**
 * Where several stretches of time overlap, and how deeply.
 *
 * A cap on how many things may happen in a window comes down to this. Each
 * occurrence casts a shadow forward the width of the window, and one more is
 * permitted exactly where fewer than `count` shadows lie on top of each other.
 *
 * `IntervalStream` cannot answer it. It coalesces, so four shadows over one
 * afternoon and one shadow over the same afternoon are the same stream, and
 * the number is the whole question. This counts instead.
 */

/**
 * A stretch with both of its ends.
 *
 * `Interval` allows an open end, because a rule may cover time without one.
 * A shadow always has both, and saying so here means nothing below has to
 * guard for an end that cannot be missing.
 */
export interface Span {
  readonly start: Temporal.ZonedDateTime;
  readonly end: Temporal.ZonedDateTime;
}

/** One end of a shadow, and which end it is. */
interface Edge {
  readonly at: Temporal.ZonedDateTime;
  readonly step: 1 | -1;
}

/**
 * The stretches where at least `depth` of the given spans overlap, in order
 * and coalesced.
 *
 * A sweep over the ends. Starts add one and finishes take one away, and the
 * places the running count crosses `depth` are the ends of the answer. Sorting
 * finishes before starts at the same instant is what keeps a span that ends
 * exactly where the next begins from counting as two at once.
 */
export function atLeastDeep(
  spans: readonly Span[],
  depth: number,
): readonly Span[] {
  const edges: Edge[] = [];
  for (const span of spans) {
    if (Temporal.ZonedDateTime.compare(span.start, span.end) >= 0) {
      // Covers no time, so it lies on top of nothing.
      continue;
    }
    edges.push({ at: span.start, step: 1 }, { at: span.end, step: -1 });
  }
  edges.sort(byInstantThenFinishFirst);

  const found: Span[] = [];
  let running = 0;
  let openedAt: Temporal.ZonedDateTime | undefined;

  for (const edge of edges) {
    const before = running;
    running += edge.step;
    if (before < depth && running >= depth) {
      openedAt = edge.at;
    } else if (before >= depth && running < depth && openedAt !== undefined) {
      push(found, openedAt, edge.at);
      openedAt = undefined;
    }
  }
  return found;
}

/** Adds a stretch, joining it to the one before when they touch. */
function push(
  found: Span[],
  start: Temporal.ZonedDateTime,
  end: Temporal.ZonedDateTime,
): void {
  const last = found.at(-1);
  if (
    last !== undefined &&
    Temporal.ZonedDateTime.compare(last.end, start) === 0
  ) {
    found[found.length - 1] = { start: last.start, end };
    return;
  }
  found.push({ start, end });
}

function byInstantThenFinishFirst(left: Edge, right: Edge): number {
  const order = Temporal.ZonedDateTime.compare(left.at, right.at);
  return order === 0 ? left.step - right.step : order;
}
