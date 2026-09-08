/**
 * Working out which cycle an instant falls in, for the explanation.
 *
 * The counting is [every-periods.ts](./every-periods.ts)'s, the same function
 * the evaluator uses, so the account and the answer cannot disagree.
 */

import { describeEvery } from "./every-explanation-text.js";
import { periodsBetween } from "./every-periods.js";
import type { EveryRule } from "./rule.js";

export function describeEveryMatch(
  rule: EveryRule,
  at: Temporal.ZonedDateTime,
  matched: boolean,
): string {
  // Read on the instant's own calendar, the way `everyIntervals` reads it.
  // Counting between two dates that disagree about the calendar is refused.
  const date = at.toPlainDate();
  const anchor = Temporal.PlainDate.from(rule.anchor).withCalendar(
    date.calendarId,
  );
  return describeEvery(
    rule.interval,
    rule.period,
    rule.anchor,
    periodsBetween(anchor, date, rule.period),
    matched,
  );
}
