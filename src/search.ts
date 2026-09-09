import type { Context, QueryWindow } from "./context.js";
import { asDuration, type DurationInput } from "./duration-input.js";
import { earlierEnd } from "./interval.js";
import { checkWindow } from "./validation.js";

/** Options that bound a query which looks ahead for an answer. */
export interface Search {
  /** Look no further ahead than this duration from the starting instant. */
  readonly within?: DurationInput;
  /** Whether returned intervals stop at the search boundary. */
  readonly intervalEnd?: "clipped" | "complete";
  /** Maximum elapsed or calendar time to search for a complete interval's end. */
  readonly endWithin?: DurationInput;
}

/** The default guard for a search with no caller-supplied end. */
export const DEFAULT_SEARCH_LIMIT: Readonly<Temporal.DurationLike> =
  Object.freeze({ years: 100 });

/** A query exhausted its safety limit before it found an answer. */
export class SearchLimitExceededError extends Error {
  public constructor(operation: string, limit: DurationInput) {
    super(
      `${operation} found no answer within its ${asDuration(limit).toString()} safety limit. ` +
        "Pass `within` to define the range in which no answer is expected.",
    );
    this.name = "SearchLimitExceededError";
  }
}

export interface BoundedSearch {
  readonly context: QueryWindow;
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
  const within =
    search?.within === undefined ? undefined : asDuration(search.within);
  if (within !== undefined && within.sign < 0) {
    throw new RangeError("A search `within` duration cannot be negative.");
  }
  if (context.to !== undefined) {
    if (within === undefined) {
      return { context: { ...context, to: context.to } };
    }
    const horizon = context.from.add(within);
    return {
      context: { ...context, to: earlierEnd(context.to, horizon) ?? horizon },
    };
  }

  const limit = within ?? asDuration(DEFAULT_SEARCH_LIMIT);
  return {
    context: { ...context, to: context.from.add(limit) },
    ...(within === undefined ? { automaticLimit: limit } : {}),
  };
}
