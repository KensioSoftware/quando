import { valueAt } from "./assigned.js";
import { firstAvailableSlot, availableSlots } from "./availability.js";
import type { Cascade } from "./cascade.js";
import type { EvaluationOptions } from "./context.js";
import { withEvaluationOptions } from "./evaluation-options.js";
import { coverageChanges } from "./coverage-changes.js";
import { explainSchedule } from "./explain.js";
import {
  addCoveredTime,
  coveredDuration,
  nextCoveredInterval,
} from "./query.js";
import { addOpenDays, openDayCount } from "./schedule-days.js";
import type { Schedule, QueryArrival } from "./schedule-types.js";
import { scheduleTimeline } from "./schedule-timeline.js";
import { validate } from "./semantic-validation.js";

type ScheduleQueries = Pick<
  Schedule,
  | "isOpen"
  | "explain"
  | "nextOpenInterval"
  | "firstOpenSlot"
  | "openSlots"
  | "changesTo"
  | "validate"
  | "addOpenTime"
  | "openDuration"
  | "addOpenDays"
  | "openDayCount"
  | "timeline"
>;

/** Creates schedule queries sharing the attached evaluation settings. */
export function scheduleQueries(
  document: Cascade<boolean>,
  zone?: string,
  read?: EvaluationOptions,
): ScheduleQueries {
  return {
    isOpen: (at, options) =>
      valueAt(document, at, { ...read, ...options }) ?? false,
    explain: (at, options) =>
      explainSchedule(document, at, { ...read, ...options }),
    nextOpenInterval: (from, options) =>
      nextCoveredInterval(document, { ...read, ...options, from }, options),
    firstOpenSlot: (from, lasting, options) =>
      firstAvailableSlot(document, lasting, { ...read, ...options, from }),
    openSlots: (from, to, options) =>
      availableSlots(document, { ...read, ...options, from, to }, options),
    changesTo: (next, from, to, options) => {
      const source = withEvaluationOptions({ cascade: document }, read);
      const changed = coverageChanges(source, next, { ...options, from, to });
      return { opened: changed.added, closed: changed.removed };
    },
    validate: (from, to, options) =>
      validate(document, { ...read, ...options, from, to }, options),
    addOpenTime: (from, amount, options) =>
      addCoveredTime(from, amount, {
        ...read,
        ...options,
        during: document,
      }) as QueryArrival<typeof amount>,
    openDuration: (from, to, options) =>
      coveredDuration(document, { ...read, ...options, from, to }),
    addOpenDays: (from, count, options) =>
      addOpenDays(document, zone, from, count, {
        ...read,
        ...options,
      }) as QueryArrival<typeof count>,
    openDayCount: (from, to, options) =>
      openDayCount(document, zone, from, to, { ...read, ...options }),
    timeline: (from, to, options) =>
      scheduleTimeline(document, zone, from, to, { ...read, ...options }),
  };
}
