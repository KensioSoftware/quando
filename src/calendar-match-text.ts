/**
 * Describing a match on one of the rules that names a calendar or a clock.
 *
 * The leaves. [rule-explanation-text.ts](./rule-explanation-text.ts) keeps the
 * constants and the rules that hold other rules and hands the leaves here, the
 * way `parse.ts` and `canonical-rule.ts` hand theirs on.
 *
 * A leaf reads the instant under the scope it inherits, and says so when the
 * scope names a zone, so an account of a London rule read from Tokyo is not
 * quietly about Tokyo. The calendar arrives the same way. That is what keeps
 * "the 1st" in an account of Rosh Chodesh meaning the Hebrew 1st.
 */

import {
  describeDate,
  describeDateRange,
  describeDay,
  describeTime,
} from "./calendar-explanation-text.js";
import { describeEveryMatch } from "./every-match-text.js";
import {
  describeMonth,
  describeMonthCode,
  describeMonthDay,
  describeNthDayOfWeekInMonth,
} from "./month-explanation-text.js";
import type { CalendarRule } from "./rule.js";
import type { RuleScope } from "./rule-explanation.js";

export function describeCalendarMatch(
  rule: CalendarRule,
  at: Temporal.ZonedDateTime,
  matched: boolean,
  scope: RuleScope,
): string {
  const local = readAt(at, rule.zone ?? scope.zone, scope.calendar);

  switch (rule.type) {
    case "daysOfWeek": {
      return inNamedZone(describeDay(rule.days, local), rule.zone);
    }
    case "daysOfMonth": {
      return inNamedZone(
        describeMonthDay(rule.days, local, matched),
        rule.zone,
      );
    }
    case "nthDayOfWeekInMonth": {
      return inNamedZone(
        describeNthDayOfWeekInMonth(rule.nth, rule.days, local, matched),
        rule.zone,
      );
    }
    case "monthsOfYear": {
      return inNamedZone(describeMonth(rule.months, local), rule.zone);
    }
    case "monthCodes": {
      return inNamedZone(
        describeMonthCode(rule.codes, local, matched),
        rule.zone,
      );
    }
    case "every": {
      return inNamedZone(describeEveryMatch(rule, local, matched), rule.zone);
    }
    case "dateRange": {
      return inNamedZone(
        describeDateRange(rule.from, rule.to, local, matched),
        rule.zone,
      );
    }
    case "dates": {
      return inNamedZone(describeDate(rule.dates, local, matched), rule.zone);
    }
    case "timeOfDay": {
      return inNamedZone(
        describeTime(rule.from, rule.to, local, matched),
        rule.zone,
      );
    }
  }
}

function readAt(
  at: Temporal.ZonedDateTime,
  zone: string | undefined,
  calendar: string | undefined,
): Temporal.ZonedDateTime {
  const zoned = zone === undefined ? at : at.withTimeZone(zone);
  return calendar === undefined ? zoned : zoned.withCalendar(calendar);
}

function inNamedZone(description: string, zone: string | undefined): string {
  return zone === undefined
    ? description
    : `The rule uses ${zone}. ${description}`;
}
