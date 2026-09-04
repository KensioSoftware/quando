/**
 * Describing a match on one of the rules that names a calendar or a clock.
 *
 * The leaves. [rule-explanation-text.ts](./rule-explanation-text.ts) keeps the
 * constants and the rules that hold other rules and hands the leaves here, the
 * way `parse.ts` and `canonical-rule.ts` hand theirs on.
 *
 * A leaf reads the instant in its own zone when it names one, and says so, so
 * an account of a London rule read from Tokyo is not quietly about Tokyo.
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
  describeMonthDay,
  describeNthDayOfWeekInMonth,
} from "./month-explanation-text.js";
import type { CalendarRule } from "./rule.js";

export function describeCalendarMatch(
  rule: CalendarRule,
  at: Temporal.ZonedDateTime,
  matched: boolean,
  inheritedZone: string | undefined,
): string {
  switch (rule.type) {
    case "daysOfWeek": {
      return inNamedZone(
        describeDay(rule.days, localAt(at, rule.zone ?? inheritedZone)),
        rule.zone,
      );
    }
    case "daysOfMonth": {
      return inNamedZone(
        describeMonthDay(
          rule.days,
          localAt(at, rule.zone ?? inheritedZone),
          matched,
        ),
        rule.zone,
      );
    }
    case "nthDayOfWeekInMonth": {
      return inNamedZone(
        describeNthDayOfWeekInMonth(
          rule.nth,
          rule.days,
          localAt(at, rule.zone ?? inheritedZone),
          matched,
        ),
        rule.zone,
      );
    }
    case "monthsOfYear": {
      return inNamedZone(
        describeMonth(rule.months, localAt(at, rule.zone ?? inheritedZone)),
        rule.zone,
      );
    }
    case "every": {
      return inNamedZone(
        describeEveryMatch(
          rule,
          localAt(at, rule.zone ?? inheritedZone),
          matched,
        ),
        rule.zone,
      );
    }
    case "dateRange": {
      return inNamedZone(
        describeDateRange(
          rule.from,
          rule.to,
          localAt(at, rule.zone ?? inheritedZone),
          matched,
        ),
        rule.zone,
      );
    }
    case "dates": {
      return inNamedZone(
        describeDate(
          rule.dates,
          localAt(at, rule.zone ?? inheritedZone),
          matched,
        ),
        rule.zone,
      );
    }
    case "timeOfDay": {
      return inNamedZone(
        describeTime(
          rule.from,
          rule.to,
          localAt(at, rule.zone ?? inheritedZone),
          matched,
        ),
        rule.zone,
      );
    }
  }
}

function localAt(
  at: Temporal.ZonedDateTime,
  zone: string | undefined,
): Temporal.ZonedDateTime {
  return zone === undefined ? at : at.withTimeZone(zone);
}

function inNamedZone(description: string, zone: string | undefined): string {
  return zone === undefined
    ? description
    : `The rule uses ${zone}. ${description}`;
}
