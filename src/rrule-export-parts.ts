/**
 * The recurrence written out, part by part.
 *
 * Order follows RFC 5545's own listing, which is also the order a reader
 * expects: how often, until when, and then what narrows it. `INTERVAL=1` and
 * `WKST=MO` are the defaults said twice, so neither is written.
 */

import type { ClockParts } from "./rrule-export-time.js";
import type { Frequency } from "./rrule-export-frequency.js";
import { MONTHS, type Month, type Weekday } from "./rule.js";
import type { NthDays, RRuleSlots } from "./rrule-export-slots.js";

/** RFC 5545 writes weekdays as two-letter codes. */
export const CODE_OF: Record<Weekday, string> = {
  monday: "MO",
  tuesday: "TU",
  wednesday: "WE",
  thursday: "TH",
  friday: "FR",
  saturday: "SA",
  sunday: "SU",
};

export function rruleText(
  frequency: Frequency,
  clock: ClockParts,
  until: string | undefined,
): string {
  const weekStart = frequency.weekStart;

  return [
    `FREQ=${frequency.freq}`,
    ...part(
      "INTERVAL",
      frequency.interval > 1 ? `${frequency.interval}` : undefined,
    ),
    ...part("UNTIL", until),
    ...byParts(frequency.slots),
    ...part("BYHOUR", numbers(clock.hours)),
    ...part("BYMINUTE", numbers(clock.minutes)),
    ...part("WKST", weekStart === undefined ? undefined : CODE_OF[weekStart]),
  ].join(";");
}

function byParts(slots: RRuleSlots): string[] {
  return [
    ...part("BYMONTH", numbers(monthNumbers(slots.months))),
    ...part("BYMONTHDAY", numbers(slots.daysOfMonth)),
    ...part("BYDAY", byDay(slots)),
  ];
}

/** One `NAME=VALUE` part, or nothing when the recurrence does not name it. */
function part(name: string, value: string | undefined): string[] {
  return value === undefined ? [] : [`${name}=${value}`];
}

/**
 * `BYDAY` holds both kinds of day selection at once.
 *
 * Counted days first, then bare weekdays, which is the order the same part
 * comes apart in on the way back.
 */
function byDay(slots: RRuleSlots): string | undefined {
  const codes = [
    ...slots.nths.flatMap((entry) => counted(entry)),
    ...slots.weekdays.map((day) => CODE_OF[day]),
  ];
  return codes.length === 0 ? undefined : codes.join(",");
}

function counted(entry: NthDays): string[] {
  return entry.days.map((day) => `${entry.nth}${CODE_OF[day]}`);
}

function numbers(values: readonly number[] | undefined): string | undefined {
  return values === undefined || values.length === 0
    ? undefined
    : values.join(",");
}

function monthNumbers(months: readonly Month[]): number[] {
  return MONTHS.flatMap((name, index) =>
    months.includes(name) ? [index + 1] : [],
  );
}
