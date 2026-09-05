/**
 * Where the recurrence begins, and where it stops.
 *
 * DTSTART is not optional in RFC 5545 and a Quando rule need not have one. A
 * rule about Mondays is about every Monday there has ever been. So the rule's
 * own lower bound is where to start looking when it has one, the caller says
 * where to look when it has none, and a rule with neither is one this cannot
 * write.
 *
 * Looking, because a lower bound is not yet a DTSTART. RFC 5545 leaves the
 * recurrence set undefined when DTSTART is not one of the recurrence's own
 * occurrences, so a rule about Mondays bounded from a Tuesday has to start on
 * the Monday after it. The rule answers that itself, which settles the cycle,
 * the weekdays and the days of the month together.
 *
 * `UNTIL` has to be the same kind of value as DTSTART, so a whole-day
 * recurrence gets a bare date and a timed one gets the instant the last day
 * ends. That instant is written in UTC, which is what RFC 5545 asks for and
 * what [rrule-until.ts](./rrule-until.ts) reads back.
 */

import { type Unwritable, unwritable } from "./export-result.js";
import { nextCoveredInterval } from "./query.js";
import type { Rule } from "./rule.js";
import type { RRuleSlots } from "./rrule-export-slots.js";
import { DEFAULT_SEARCH_LIMIT } from "./search.js";
import { asDate } from "./validation.js";

/** DTSTART as it is written, and the UNTIL that bounds it. */
export interface Bounds {
  readonly ok: true;
  readonly start: string;
  readonly until: string | undefined;
}

export function boundsOf(
  rule: Rule,
  slots: RRuleSlots,
  time: string | undefined,
  zone: string | undefined,
  given: string | undefined,
): Bounds | Unwritable {
  const from =
    slots.from ?? (given === undefined ? undefined : asDate(given, "start"));

  if (from === undefined) {
    return unwritable(
      "nothing in it says when the recurrence begins, and every recurrence starts at DTSTART. Bound the rule with `onOrAfter`, or pass `start`",
    );
  }

  const date = firstCovered(rule, from, zone ?? "UTC");
  if (date === undefined) {
    return unwritable(
      `it covers no time on or after ${from}, so there is no first occurrence for DTSTART to be`,
    );
  }

  return {
    ok: true,
    start: time === undefined ? date : `${date}T${time}`,
    until:
      slots.to === undefined
        ? undefined
        : untilOf(slots.to, time !== undefined, zone),
  };
}

/**
 * The first day on or after a date that the rule covers.
 *
 * Asked of the rule rather than worked out from the parts, so a cycle, a BYDAY
 * and a BYMONTHDAY are all accounted for at once and none of them is a case to
 * remember. The search runs to the library's own safety limit, and a rule with
 * nothing in that span has no DTSTART to give.
 */
function firstCovered(
  rule: Rule,
  from: string,
  zone: string,
): string | undefined {
  const start = Temporal.PlainDate.from(from).toZonedDateTime({
    timeZone: zone,
  });
  const covered = nextCoveredInterval(rule, {
    from: start,
    to: start.add(DEFAULT_SEARCH_LIMIT),
  })?.start;

  return covered?.toPlainDate().toString();
}

/**
 * The last day, as the kind of value DTSTART is.
 *
 * A timed recurrence is bounded at the end of that day rather than at its
 * start, because `onOrBefore` covers the day whole. The end of a day is a
 * different instant in every zone, so it is converted from the one the rule
 * runs on — UTC when the rule names none, which is the reading going the other
 * way as well.
 */
function untilOf(to: string, timed: boolean, zone: string | undefined): string {
  const date = to.replaceAll("-", "");
  if (!timed) {
    return date;
  }

  const last = Temporal.ZonedDateTime.from(
    `${to}T23:59:59[${zone ?? "UTC"}]`,
  ).withTimeZone("UTC");

  return `${last
    .toPlainDateTime()
    .toString({ smallestUnit: "second" })
    .replaceAll("-", "")
    .replaceAll(":", "")}Z`;
}
