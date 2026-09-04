/** Opening-hours names for the common queries. */

import { valueAt } from "./assigned.js";
import { firstGap, slots } from "./availability.js";
import type { Cascade } from "./cascade.js";
import { coverageChanges } from "./coverage-changes.js";
import { explainSchedule } from "./explain.js";
import { advanceBy, coveredDuration, nextCoveredInterval } from "./query.js";
import { scheduleSearchOptions } from "./schedule-search.js";
import type { Schedule } from "./schedule-types.js";
import { renderScheduleTimeline } from "./schedule-timeline.js";
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
  | "renderTimeline"
>;

/** Creates the query methods restored onto a schedule. */
export function scheduleQueries(
  document: Cascade<boolean>,
  zone?: string,
): ScheduleQueries {
  return {
    isOpen: (at) => valueAt(document, at) ?? false,
    explain: (at) => explainSchedule(document, at),
    opensNext: (at, search) =>
      nextCoveredInterval(
        document,
        { from: at },
        {
          ...scheduleSearchOptions(search),
          complete: true,
        },
      ),
    firstOpenSlot: (from, lasting, search) =>
      firstGap(document, lasting, { from }, scheduleSearchOptions(search)),
    openSlots: (from, to, options) => slots(document, { from, to }, options),
    changesTo: (next, from, to) => {
      const changed = coverageChanges(document, next, { from, to });
      return { opened: changed.added, closed: changed.removed };
    },
    validate: (from, to) => validate(document, { from, to }),
    addOpenTime: (from, amount, search) =>
      advanceBy(from, amount, { during: document, ...search }),
    openDuration: (from, to) => coveredDuration(document, { from, to }),
    renderTimeline: (from, to, options) =>
      renderScheduleTimeline(document, zone, from, to, options),
  };
}
