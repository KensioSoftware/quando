/**
 * Reading the rule types that name something on a calendar or a clock.
 *
 * The leaves. [interpret.ts](./interpret.ts) keeps the structure, the
 * constants and the clipping, and hands the leaves here, the way `parse.ts`
 * and `canonical-rule.ts` hand theirs on.
 *
 * Nothing here clips. Every caller does, because clipping is what makes an
 * endless leaf terminate and one place to get that right is enough.
 */

import type { Context } from "./context.js";
import { dateIntervals, weekdayIntervals } from "./day-rules.js";
import { everyIntervals } from "./every-rules.js";
import type { IntervalStream } from "./interval-stream.js";
import {
  dayOfMonthIntervals,
  monthCodeIntervals,
  monthIntervals,
  nthDayOfWeekInMonthIntervals,
} from "./month-rules.js";
import { dateRangeIntervals } from "./range-rules.js";
import type { CalendarRule } from "./rule.js";
import { timeOfDayIntervals } from "./time-rules.js";

export function calendarIntervals(
  rule: CalendarRule,
  context: Context,
): IntervalStream {
  switch (rule.type) {
    case "daysOfWeek": {
      return weekdayIntervals(context, rule.days, rule.zone);
    }
    case "daysOfMonth": {
      return dayOfMonthIntervals(context, rule.days, rule.zone);
    }
    case "nthDayOfWeekInMonth": {
      return nthDayOfWeekInMonthIntervals(
        context,
        rule.nth,
        rule.days,
        rule.zone,
      );
    }
    case "monthsOfYear": {
      return monthIntervals(context, rule.months, rule.zone);
    }
    case "monthCodes": {
      return monthCodeIntervals(context, rule.codes, rule.zone);
    }
    case "dates": {
      return dateIntervals(context, rule.dates, rule.zone);
    }
    case "every": {
      return everyIntervals(
        context,
        rule.interval,
        rule.period,
        rule.anchor,
        rule.zone,
      );
    }
    case "dateRange": {
      return dateRangeIntervals(context, rule.from, rule.to, rule.zone);
    }
    case "timeOfDay": {
      return timeOfDayIntervals(context, rule.from, rule.to, rule.zone);
    }
  }
}
