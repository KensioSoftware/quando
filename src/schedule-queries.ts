/** Opening-hours names for the common queries. */

import { valueAt } from "./assigned.js";
import { firstGap, slots } from "./availability.js";
import type { Cascade } from "./cascade.js";
import { coverageChanges } from "./coverage-changes.js";
import { explain, withDefaultValue } from "./explain.js";
import {
  advanceBy,
  coveredDuration,
  nextCoveredInterval,
  type Search,
} from "./query.js";
import type { Schedule } from "./schedule-types.js";
import { validate } from "./semantic-validation.js";

type ScheduleQueries = Pick<
  Schedule,
  | "isOpen"
  | "explain"
  | "opensNext"
  | "firstOpenSlot"
  | "openSlots"
  | "changesTo"
  | "validate"
  | "addOpenTime"
  | "openDuration"
>;

function searchOptions(search: Search | Temporal.Duration | undefined): Search {
  if (search === undefined) {
    return {};
  }
  return search instanceof Temporal.Duration ? { within: search } : search;
}

/** Creates the query methods restored onto a schedule. */
export function scheduleQueries(document: Cascade<boolean>): ScheduleQueries {
  return {
    isOpen: (at) => valueAt(document, at) ?? false,
    explain: (at) => withDefaultValue(explain(document, at), false),
    opensNext: (at, search) =>
      nextCoveredInterval(
        document,
        { from: at },
        {
          ...searchOptions(search),
          complete: true,
        },
      ),
    firstOpenSlot: (from, lasting, search) =>
      firstGap(document, lasting, { from }, searchOptions(search)),
    openSlots: (from, to, options) => slots(document, { from, to }, options),
    changesTo: (next, from, to) => {
      const changed = coverageChanges(document, next, { from, to });
      return { opened: changed.added, closed: changed.removed };
    },
    validate: (from, to) => validate(document, { from, to }),
    addOpenTime: (from, amount, search) =>
      advanceBy(from, amount, { during: document, ...search }),
    openDuration: (from, to) => coveredDuration(document, { from, to }),
  };
}
