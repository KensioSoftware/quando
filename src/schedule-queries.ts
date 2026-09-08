/** Opening-hours names for the common queries. */

import { valueAt } from "./assigned.js";
import { firstGap, slots } from "./availability.js";
import type { Cascade } from "./cascade.js";
import type { Context } from "./context.js";
import { coverageChanges } from "./coverage-changes.js";
import { explainSchedule } from "./explain.js";
import { advanceBy, coveredDuration, nextCoveredInterval } from "./query.js";
import { addOpenDays, openDayCount } from "./schedule-days.js";
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
  | "addOpenDays"
  | "openDayCount"
  | "renderTimeline"
>;

/**
 * Creates the query methods restored onto a schedule.
 *
 * `read` is what the schedule carries beside its window: the registry a
 * `custom` rule in one of its scopes is looked up in. Every query builds its
 * own window, so each spreads `read` into the context it makes.
 */
export function scheduleQueries(
  document: Cascade<boolean>,
  zone?: string,
  read?: Omit<Context, "from" | "to">,
): ScheduleQueries {
  return {
    isOpen: (at) => valueAt(document, at, read) ?? false,
    explain: (at) => explainSchedule(document, at, read),
    opensNext: (at, search) =>
      nextCoveredInterval(
        document,
        { ...read, from: at },
        {
          ...scheduleSearchOptions(search),
          complete: true,
        },
      ),
    firstOpenSlot: (from, lasting, search) =>
      firstGap(
        document,
        lasting,
        { ...read, from },
        scheduleSearchOptions(search),
      ),
    openSlots: (from, to, options) =>
      slots(document, { ...read, from, to }, options),
    changesTo: (next, from, to) => {
      const changed = coverageChanges(document, next, { ...read, from, to });
      return { opened: changed.added, closed: changed.removed };
    },
    validate: (from, to) => validate(document, { ...read, from, to }),
    addOpenTime: (from, amount, search) =>
      advanceBy(from, amount, { ...read, during: document, ...search }),
    openDuration: (from, to) =>
      coveredDuration(document, { ...read, from, to }),
    addOpenDays: (from, count, options) =>
      addOpenDays(document, zone, from, count, { ...read, ...options }),
    openDayCount: (from, to) => openDayCount(document, zone, from, to, read),
    renderTimeline: (from, to, options) =>
      renderScheduleTimeline(document, zone, from, to, options, read),
  };
}
