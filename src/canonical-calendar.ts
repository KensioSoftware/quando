/**
 * Writing the leaves of a rule the one way.
 *
 * The rules that name a day, a month, a date or a time, normalised field by
 * field. [canonical-rule.ts](./canonical-rule.ts) keeps the structure around
 * them and hands the leaves here, the way `parse.ts` hands them to
 * `parse-calendar.ts`.
 */

import {
  canonicalDate,
  canonicalDates,
  canonicalDays,
  canonicalMonthDays,
  canonicalMonths,
  canonicalTime,
} from "./canonical-leaves.js";
import type { CalendarRule, Rule } from "./rule.js";

/** Present or absent, never present-and-undefined. */
function zonePart(zone: string | undefined): { zone?: string } {
  return zone === undefined ? {} : { zone };
}

export function canonicalCalendarRule(rule: CalendarRule): Rule {
  switch (rule.type) {
    case "daysOfWeek": {
      return {
        type: "daysOfWeek",
        days: canonicalDays(rule.days),
        ...zonePart(rule.zone),
      };
    }

    case "daysOfMonth": {
      return {
        type: "daysOfMonth",
        days: canonicalMonthDays(rule.days),
        ...zonePart(rule.zone),
      };
    }

    case "nthDayOfWeekInMonth": {
      return {
        type: "nthDayOfWeekInMonth",
        nth: rule.nth,
        days: canonicalDays(rule.days),
        ...zonePart(rule.zone),
      };
    }

    case "monthsOfYear": {
      return {
        type: "monthsOfYear",
        months: canonicalMonths(rule.months),
        ...zonePart(rule.zone),
      };
    }

    case "dates": {
      return {
        type: "dates",
        dates: canonicalDates(rule.dates),
        ...zonePart(rule.zone),
      };
    }

    case "every": {
      return {
        type: "every",
        interval: rule.interval,
        period: rule.period,
        anchor: canonicalDate(rule.anchor),
        ...zonePart(rule.zone),
      };
    }

    case "dateRange": {
      // Spread from the rule rather than rebuilt end by end. The two ends are
      // not a discriminant, so narrowing on one tells TypeScript nothing about
      // the other, and rebuilding would need a branch that cannot happen. The
      // spread carries the zone, so there is nothing for `zonePart` to add.
      return {
        ...rule,
        ...(rule.from === undefined ? {} : { from: canonicalDate(rule.from) }),
        ...(rule.to === undefined ? {} : { to: canonicalDate(rule.to) }),
      };
    }

    case "timeOfDay": {
      return {
        type: "timeOfDay",
        from: canonicalTime(rule.from),
        to: canonicalTime(rule.to),
        ...zonePart(rule.zone),
      };
    }
  }
}
