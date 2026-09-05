/**
 * Where the recurrence begins, and where it stops.
 *
 * DTSTART is not optional in RFC 5545 and a Quando rule need not have one: a
 * rule about Mondays is about every Monday there has ever been. So the rule's
 * own lower bound is DTSTART where it has one, the caller says where it has
 * none, and a rule with neither is one this cannot write.
 *
 * `UNTIL` has to be the same kind of value as DTSTART, so a whole-day
 * recurrence gets a bare date and a timed one gets the instant the last day
 * ends. That instant is written in UTC, which is what RFC 5545 asks for and
 * what [rrule-until.ts](./rrule-until.ts) reads back.
 */

import { type Unwritable, unwritable } from "./export-result.js";
import { onCycle, periodsBetween } from "./every-periods.js";
import type { EveryRule } from "./rule.js";
import type { RRuleSlots } from "./rrule-export-slots.js";
import { asDate } from "./validation.js";

/** DTSTART as it is written, and the UNTIL that bounds it. */
export interface Bounds {
  readonly ok: true;
  readonly start: string;
  readonly until: string | undefined;
}

export function boundsOf(
  slots: RRuleSlots,
  time: string | undefined,
  zone: string | undefined,
  given: string | undefined,
): Bounds | Unwritable {
  const date =
    slots.from ?? (given === undefined ? undefined : asDate(given, "start"));

  if (date === undefined) {
    return unwritable(
      "nothing in it says when the recurrence begins, and every recurrence starts at DTSTART. Bound the rule with `onOrAfter`, or pass `start`",
    );
  }
  if (slots.every !== undefined && !reaches(slots.every, date)) {
    return unwritable(
      `it begins on ${date}, which its cycle of ${slots.every.interval} ${slots.every.period} does not reach`,
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

/** Whether a cycle covers the day the recurrence is to start on. */
function reaches(every: EveryRule, date: string): boolean {
  return onCycle(
    periodsBetween(
      Temporal.PlainDate.from(every.anchor),
      Temporal.PlainDate.from(date),
      every.period,
    ),
    every.interval,
  );
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
