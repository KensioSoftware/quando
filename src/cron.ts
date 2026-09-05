/**
 * Reading a cron expression as a Quando rule.
 *
 * Cron says when a command runs. A rule says what time it covers. The bridge
 * is that a firing time becomes the minute starting there, so
 * `0 9 * * 1-5` covers 09:00 to 09:01 on weekdays, and
 * `nextCoveredInterval` over it answers "when does this next run".
 *
 * The dialect is the five-field POSIX one, including the rule that a day of
 * the month and a day of the week both restricted means either.
 */

import { all, always, any, inZone } from "./build.js";
import { build, type Built } from "./built-rule.js";
import {
  type CronSelection,
  DAY_OF_MONTH_FIELD,
  DAY_OF_WEEK_FIELD,
  HOUR_FIELD,
  MINUTE_FIELD,
  MONTH_FIELD,
} from "./cron-field-types.js";
import { parseCronField } from "./cron-fields.js";
import { type CronFields, expandedFields } from "./cron-shorthands.js";
import { coveredMinutes, timeOfDayRule } from "./minute-windows.js";
import { daysOfMonth, monthsOfYear } from "./month-builders.js";
import { daysOfWeek } from "./calendar-rules.js";
import {
  type Month,
  MONTHS,
  type Rule,
  WEEKDAYS,
  type Weekday,
} from "./rule.js";
import { asZone } from "./validation.js";

export interface CronOptions {
  /** The zone the cron daemon runs in. Defaults to the query context's. */
  readonly zone?: string;
}

/**
 * A rule covering the minutes a cron expression fires in.
 *
 * Throws a `TypeError` naming the field at fault when the expression will not
 * parse.
 */
export function parseCron(
  expression: string,
  options: CronOptions = {},
): Built<Rule> {
  const rule = ruleFor(expandedFields(expression));
  return options.zone === undefined
    ? build(rule)
    : inZone(asZone(options.zone, "zone"), rule);
}

function ruleFor(fields: CronFields): Rule {
  const minute = parseCronField(fields[0], MINUTE_FIELD);
  const hour = parseCronField(fields[1], HOUR_FIELD);
  const dayOfMonth = parseCronField(fields[2], DAY_OF_MONTH_FIELD);
  const month = parseCronField(fields[3], MONTH_FIELD);
  const dayOfWeek = parseCronField(fields[4], DAY_OF_WEEK_FIELD);

  return all(
    timeOfDayRule(coveredMinutes(hour.values, minute.values)),
    monthRule(month),
    dayRule(dayOfMonth, dayOfWeek),
  );
}

function monthRule(month: CronSelection): Rule {
  if (!month.restricted) {
    return always();
  }
  return monthsOfYear(...monthsOf(month));
}

/**
 * The day a cron expression runs on.
 *
 * Both day fields restricted means either matches, which is the one piece of
 * cron nobody expects. `0 0 13 * 5` is the 13th of the month *and* every
 * Friday, not only Friday the 13th. POSIX specifies it and every cron in wide
 * use follows it.
 */
function dayRule(dayOfMonth: CronSelection, dayOfWeek: CronSelection): Rule {
  const byMonth = daysOfMonth(...dayOfMonth.values);
  const byWeek = daysOfWeek(...weekdaysOf(dayOfWeek));

  if (dayOfMonth.restricted && dayOfWeek.restricted) {
    return any(byMonth, byWeek);
  }
  if (dayOfMonth.restricted) {
    return byMonth;
  }
  if (dayOfWeek.restricted) {
    return byWeek;
  }
  return always();
}

/**
 * Cron numbers Sunday first and accepts it as both 0 and 7.
 *
 * `WEEKDAYS` starts on Monday, so Monday sits at index 0 and carries cron's 1.
 */
function weekdaysOf(dayOfWeek: CronSelection): Weekday[] {
  const wanted = new Set(dayOfWeek.values.map((value) => value % 7));
  return WEEKDAYS.filter((_, index) => wanted.has((index + 1) % 7));
}

function monthsOf(month: CronSelection): Month[] {
  const wanted = new Set(month.values);
  return MONTHS.filter((_, index) => wanted.has(index + 1));
}
