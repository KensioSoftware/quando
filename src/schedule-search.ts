import type { Search } from "./query.js";

/** Accepts the short duration form used by schedule search methods. */
export function scheduleSearchOptions(
  search: Search | Temporal.Duration | undefined,
): Search {
  if (search === undefined) {
    return {};
  }
  return search instanceof Temporal.Duration ? { within: search } : search;
}
