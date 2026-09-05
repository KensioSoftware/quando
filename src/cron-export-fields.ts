/**
 * Writing the five fields out.
 *
 * Consecutive values become a range, which is what a person writing cron by
 * hand does and what makes `1-5` rather than `1,2,3,4,5`. A field holding
 * every value it can becomes a star — except the two day fields, where a star
 * means something else. Cron reads two *restricted* day fields as either one
 * matching, so a day field naming all of its days has to keep saying so.
 */

import { type Unwritable, unwritable } from "./export-result.js";
import { factorsOf, MINUTES_IN_A_DAY } from "./day-windows.js";
import type { CronSlots } from "./cron-export-slots.js";
import { MONTHS, WEEKDAYS, type Month, type Weekday } from "./rule.js";

const DAYS_IN_A_WEEK = 7;

interface Written {
  readonly ok: true;
  readonly cron: string;
}

/** The five fields of a cron expression, in the order cron writes them. */
export function cronText(slots: CronSlots): Written | Unwritable {
  const clock = clockFields(slots.minutes);
  if (!clock.ok) {
    return clock;
  }

  const fields = [
    clock.minute,
    clock.hour,
    slots.daysOfMonth === undefined ? "*" : listText(slots.daysOfMonth),
    slots.months === undefined
      ? "*"
      : fieldText(monthNumbers(slots.months), 1, 12),
    slots.daysOfWeek === undefined
      ? "*"
      : listText(dayNumbers(slots.daysOfWeek)),
  ];
  return { ok: true, cron: fields.join(" ") };
}

interface Clock {
  readonly ok: true;
  readonly minute: string;
  readonly hour: string;
}

/**
 * The minute and hour fields.
 *
 * Cron's two clock fields select every combination of what they name, so the
 * minutes a rule covers have to be exactly such a product. A window from 09:30
 * to 17:30 is not one, and there is no pair of fields that says it.
 */
function clockFields(
  minutes: readonly number[] | undefined,
): Clock | Unwritable {
  const covered =
    minutes ?? Array.from({ length: MINUTES_IN_A_DAY }, (_, minute) => minute);
  const parts = factorsOf(covered);

  if (parts === undefined) {
    return unwritable(
      "the times it covers are not a set of hours crossed with a set of minutes, which is all cron's two clock fields can select",
    );
  }
  return {
    ok: true,
    minute: fieldText(parts.minutes, 0, 59),
    hour: fieldText(parts.hours, 0, 23),
  };
}

/** A field, as a star when it holds everything and a list when it does not. */
function fieldText(
  values: readonly number[],
  min: number,
  max: number,
): string {
  return values.length === max - min + 1 ? "*" : listText(values);
}

/** Values as cron writes them, with consecutive ones joined into a range. */
function listText(values: readonly number[]): string {
  const runs: [number, number][] = [];

  for (const value of [...new Set(values)].toSorted((a, b) => a - b)) {
    const open = runs.at(-1);
    if (open?.[1] === value - 1) {
      open[1] = value;
      continue;
    }
    runs.push([value, value]);
  }

  return runs
    .map(([from, to]) => (from === to ? `${from}` : `${from}-${to}`))
    .join(",");
}

function monthNumbers(months: readonly Month[]): number[] {
  return MONTHS.flatMap((name, index) =>
    months.includes(name) ? [index + 1] : [],
  );
}

/** Cron numbers Sunday first, so Monday carries 1 and Sunday carries 0. */
function dayNumbers(days: readonly Weekday[]): number[] {
  return WEEKDAYS.flatMap((name, index) =>
    days.includes(name) ? [(index + 1) % DAYS_IN_A_WEEK] : [],
  );
}
