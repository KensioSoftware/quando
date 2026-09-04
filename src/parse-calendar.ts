/**
 * Parsing the rule types that name something on a calendar or a clock.
 *
 * These are the leaves: they hold days, months, dates and times, and no
 * nested rules. [parse.ts](./parse.ts) keeps the shape checks, the table of
 * known types and the combinators that recurse, and hands the leaves here.
 */

import {
  asDate,
  asDates,
  asDays,
  asMonthDays,
  asMonths,
  asNth,
  asTime,
  zonePart,
} from "./parse-fields.js";
import { fail } from "./parse-shape.js";
import type { Rule } from "./rule.js";

/** The rule types this module parses. */
export type CalendarRuleType =
  | "daysOfWeek"
  | "daysOfMonth"
  | "nthDayOfWeekInMonth"
  | "monthsOfYear"
  | "dates"
  | "dateRange"
  | "timeOfDay";

export function parseCalendarRule(
  type: CalendarRuleType,
  node: Record<string, unknown>,
  path: string,
): Rule {
  switch (type) {
    case "daysOfWeek": {
      return {
        type: "daysOfWeek",
        days: asDays(node["days"], `${path}.days`),
        ...zonePart(node, path),
      };
    }

    case "daysOfMonth": {
      return {
        type: "daysOfMonth",
        days: asMonthDays(node["days"], `${path}.days`),
        ...zonePart(node, path),
      };
    }

    case "nthDayOfWeekInMonth": {
      return {
        type: "nthDayOfWeekInMonth",
        nth: asNth(node["nth"], `${path}.nth`),
        days: asDays(node["days"], `${path}.days`),
        ...zonePart(node, path),
      };
    }

    case "monthsOfYear": {
      return {
        type: "monthsOfYear",
        months: asMonths(node["months"], `${path}.months`),
        ...zonePart(node, path),
      };
    }

    case "dates": {
      return {
        type: "dates",
        dates: asDates(node["dates"], `${path}.dates`),
        ...zonePart(node, path),
      };
    }

    case "dateRange": {
      return parseDateRange(node, path);
    }

    case "timeOfDay": {
      const from = asTime(node["from"], `${path}.from`);
      const to = asTime(node["to"], `${path}.to`);
      if (Temporal.PlainTime.compare(from, to) === 0) {
        return fail(path, "a time-of-day window must have different endpoints");
      }
      return { type: "timeOfDay", from, to, ...zonePart(node, path) };
    }
  }
}

/**
 * A bounded stretch of the calendar.
 *
 * At least one end has to be there. A range with neither would be all of time
 * written the long way, and `always` already says that. The two ends are read
 * apart rather than spread together, because the rule type carries the bound
 * it has and refuses the shape with none.
 */
function parseDateRange(node: Record<string, unknown>, path: string): Rule {
  const zone = zonePart(node, path);
  const from =
    node["from"] === undefined
      ? undefined
      : asDate(node["from"], `${path}.from`);
  const to =
    node["to"] === undefined ? undefined : asDate(node["to"], `${path}.to`);

  if (from === undefined) {
    return to === undefined
      ? fail(path, "a date range needs a from, a to, or both")
      : { type: "dateRange", to, ...zone };
  }
  if (to === undefined) {
    return { type: "dateRange", from, ...zone };
  }
  if (Temporal.PlainDate.compare(from, to) > 0) {
    return fail(path, "a date range must not end before it starts");
  }
  return { type: "dateRange", from, to, ...zone };
}
