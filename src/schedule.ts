import { parseDomain } from "./parse-domain.js";
import { cascade } from "./cascade.js";
import { parseBoolean } from "./parse-shape.js";
import { restoreSchedule } from "./schedule-runtime.js";
import type { Schedule, ScheduleOptions } from "./schedule-types.js";
import { asZone } from "./validation.js";

export type {
  Schedule,
  ScheduleChanges,
  ScheduleData,
  ScheduleExplanation,
  ScheduleOptions,
  ScheduleSearch,
  QueryArrival,
} from "./schedule-types.js";

/** Creates empty opening hours in an optional local time zone. */
export function schedule(options: ScheduleOptions = {}): Schedule {
  const zone =
    options.zone === undefined ? undefined : asZone(options.zone, "zone");
  return restoreSchedule({
    type: "schedule",
    cascade: cascade<boolean>(),
    ...(zone === undefined ? {} : { zone }),
  });
}

/** Reads a stored schedule and restores its methods. */
export function parseSchedule(value: unknown, path = "schedule"): Schedule {
  return restoreSchedule({
    type: "schedule",
    ...parseDomain(value, "schedule", parseBoolean, path),
  });
}
