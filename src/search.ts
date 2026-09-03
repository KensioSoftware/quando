import type { Context } from "./context.js";
import { earlierEnd } from "./interval.js";
import { checkWindow } from "./validation.js";

const ZERO_DURATION = Temporal.Duration.from({ seconds: 0 });

/** Options that bound a query which looks ahead for an answer. */
export interface Search {
  /** Look no further ahead than this duration from the starting instant. */
  readonly within?: Temporal.Duration;
  /** Return an interval's real end when it extends beyond the search window. */
  readonly complete?: boolean;
}

/** The default guard for a search with no caller-supplied end. */
export const DEFAULT_SEARCH_LIMIT = Temporal.Duration.from({ years: 100 });

/** A query exhausted its safety limit before it found an answer. */
export class SearchLimitExceededError extends Error {
  public constructor(operation: string, limit: Temporal.Duration) {
    super(
      `${operation} found no answer within its ${limit.toString()} safety limit. ` +
        "Pass `within` to define the range in which no answer is expected.",
    );
    this.name = "SearchLimitExceededError";
  }
}

export interface BoundedSearch {
  readonly context: Context;
  readonly automaticLimit?: Temporal.Duration;
}

/** Moves a context's start and removes its previous end. */
export function restartSearch(
  context: Context,
  from: Temporal.ZonedDateTime,
): Context {
  const { to: _to, ...withoutEnd } = context;
  return { ...withoutEnd, from };
}

/** Applies a caller-supplied horizon or the automatic safety limit. */
export function boundSearch(
  context: Context,
  search: Search | undefined,
): BoundedSearch {
  checkWindow(context.from, context.to);
  const within = search?.within;
  if (
    within !== undefined &&
    Temporal.Duration.compare(within, ZERO_DURATION) < 0
  ) {
    throw new RangeError("A search `within` duration cannot be negative.");
  }
  if (context.to !== undefined) {
    if (within === undefined) {
      return { context };
    }
    const horizon = context.from.add(within);
    return {
      context: { ...context, to: earlierEnd(context.to, horizon) ?? horizon },
    };
  }

  const limit = within ?? DEFAULT_SEARCH_LIMIT;
  return {
    context: { ...context, to: context.from.add(limit) },
    ...(within === undefined ? { automaticLimit: limit } : {}),
  };
}
