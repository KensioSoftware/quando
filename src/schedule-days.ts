import type { Cascade } from "./cascade.js";
import {
  advanceByCoveredDays,
  coveredDayCount,
  type CoveredDayOptions,
} from "./covered-days.js";

/** What a schedule takes when it counts or adds whole open days. */
export type OpenDayOptions = Omit<CoveredDayOptions<boolean>, "during">;

/**
 * Reads open days in the schedule's declared zone, or in the caller's.
 *
 * A day is a date on a wall calendar, and a London schedule keeps London dates
 * however the query instant is written. `renderTimeline` picks its zone the
 * same way for the same reason. The standalone `coveredDayCount` and
 * `advanceByCoveredDays` have no schedule to ask and read the context's zone.
 */
function dayZone(zone: string | undefined, at: Temporal.ZonedDateTime): string {
  return zone ?? at.timeZoneId;
}

/** How many local dates in a finite window the schedule is open on. */
export function openDayCount(
  document: Cascade<boolean>,
  zone: string | undefined,
  from: Temporal.ZonedDateTime,
  to: Temporal.ZonedDateTime,
): number {
  const inZone = dayZone(zone, from);
  return coveredDayCount(document, {
    from: from.withTimeZone(inZone),
    to: to.withTimeZone(inZone),
  });
}

/**
 * The instant the schedule opens on the day a count of open days lands.
 *
 * The result comes back in the caller's zone, the same instant read where
 * `from` was written. `addOpenTime` answers in the caller's zone too.
 */
export function addOpenDays(
  document: Cascade<boolean>,
  zone: string | undefined,
  from: Temporal.ZonedDateTime,
  count: number,
  options?: OpenDayOptions,
): Temporal.ZonedDateTime | undefined {
  const inZone = dayZone(zone, from);
  const reached = advanceByCoveredDays(from.withTimeZone(inZone), count, {
    ...options,
    during: document,
  });
  return reached?.withTimeZone(from.timeZoneId);
}
