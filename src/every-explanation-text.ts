/**
 * Describing which cycle of a recurrence an instant falls in.
 *
 * The period count is the fact the reader cannot get from the date. "Every
 * other Monday" is only an answer once you know which Monday this is, so the
 * count and the anchor both appear.
 */

import type { Period } from "./rule.js";

const SINGULAR = new Map<Period, string>([
  ["days", "day"],
  ["weeks", "week"],
  ["months", "month"],
  ["years", "year"],
]);

export function describeEvery(
  interval: number,
  period: Period,
  anchor: string,
  periods: number,
  matched: boolean,
): string {
  const cycle =
    interval === 1 ? `every ${unit(period)}` : `every ${interval} ${period}`;
  const away = distance(periods, period);
  return `${away} ${anchor}, so it ${matched ? "is" : "is not"} on ${cycle}.`;
}

function distance(periods: number, period: Period): string {
  if (periods === 0) {
    return `This is in the same ${unit(period)} as`;
  }
  const count = Math.abs(periods);
  const named = count === 1 ? unit(period) : period;
  return periods > 0
    ? `This is ${count} ${named} after`
    : `This is ${count} ${named} before`;
}

function unit(period: Period): string {
  return SINGULAR.get(period) ?? period;
}
