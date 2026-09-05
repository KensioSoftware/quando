/**
 * The frequency a rule recurs at, and the parts that frequency implies.
 *
 * A cycle gives the frequency directly, and a rule without one recurs daily
 * with the parts narrowing it — which is the general form, since `BYMONTHDAY`,
 * `BYMONTH` and a bare `BYDAY` all limit `FREQ=DAILY` rather than expanding
 * it.
 *
 * What the frequency implies is the mirror of
 * [rrule-frequency.ts](./rrule-frequency.ts). Reading `FREQ=MONTHLY` takes the
 * day from DTSTART because a recurrence names one occurrence per period.
 * Writing one has to go the other way: a rule covering the whole of every
 * other month covers every day of it, so every day of it is written out.
 */

import { type Unwritable, unwritable } from "./export-result.js";
import { MONTHS, type Period, WEEKDAYS, type Weekday } from "./rule.js";
import type { RRuleSlots } from "./rrule-export-slots.js";

const FREQ_OF: Record<Period, string> = {
  days: "DAILY",
  weeks: "WEEKLY",
  months: "MONTHLY",
  years: "YEARLY",
};

const DAYS_OF_ANY_MONTH = Array.from({ length: 31 }, (_, index) => index + 1);

/** How often the recurrence comes round, with the parts it fills in. */
export interface Frequency {
  readonly ok: true;
  readonly freq: string;
  readonly interval: number;
  readonly weekStart: Weekday | undefined;
  readonly slots: RRuleSlots;
}

export function frequencyOf(slots: RRuleSlots): Frequency | Unwritable {
  const every = slots.every;
  if (every === undefined) {
    return checked({
      ok: true,
      freq: withoutCycle(slots),
      interval: 1,
      weekStart: undefined,
      slots,
    });
  }

  const anchor = Temporal.PlainDate.from(every.anchor);
  return checked({
    ok: true,
    freq: FREQ_OF[every.period],
    interval: every.interval,
    weekStart:
      every.period === "weeks" && every.interval > 1
        ? weekStartOf(anchor)
        : undefined,
    slots: implied(slots, every.period),
  });
}

/**
 * What a rule with no cycle in it recurs at.
 *
 * All four come to the same set of times, because `BYMONTH`, `BYMONTHDAY` and
 * `BYDAY` each narrow `FREQ=DAILY` rather than expanding it. The choice is
 * about what the recurrence says to whoever reads it next: an annual event
 * should be yearly, and a calendar showing it will say so.
 *
 * A weekday counted within the month forces the hand, since only a monthly or
 * yearly recurrence gives an ordinal a month to count in.
 */
function withoutCycle(slots: RRuleSlots): string {
  if (slots.nths.length > 0 || slots.daysOfMonth.length > 0) {
    return slots.months.length > 0 ? "YEARLY" : "MONTHLY";
  }
  return slots.weekdays.length > 0 ? "WEEKLY" : "DAILY";
}

function checked(frequency: Frequency): Frequency | Unwritable {
  const { freq, slots } = frequency;

  if (freq === "WEEKLY" && slots.daysOfMonth.length > 0) {
    return unwritable(
      "it selects days of the month within a weekly cycle, and a week has no day of the month to select",
    );
  }
  if (slots.nths.length > 0 && (freq === "DAILY" || freq === "WEEKLY")) {
    return unwritable(
      `it counts a weekday within the month inside a ${freq.toLowerCase()} cycle, and a recurrence counts within a month only under FREQ=MONTHLY or FREQ=YEARLY`,
    );
  }
  return frequency;
}

/**
 * The parts a cycle of whole periods has to write out for itself.
 *
 * `FREQ=WEEKLY;INTERVAL=2` names one day of every other week, and a rule that
 * steps through whole weeks covers all seven, so all seven are named. Months
 * and years go the same way, one level down each.
 */
function implied(slots: RRuleSlots, period: Period): RRuleSlots {
  const named =
    slots.weekdays.length > 0 ||
    slots.nths.length > 0 ||
    slots.daysOfMonth.length > 0;

  if (period === "days") {
    return slots;
  }
  if (period === "weeks") {
    return named ? slots : { ...slots, weekdays: [...WEEKDAYS] };
  }

  const daysOfMonth = named ? slots.daysOfMonth : DAYS_OF_ANY_MONTH;
  if (period === "months") {
    return { ...slots, daysOfMonth };
  }
  // A yearly cycle covers every month of the year as well as every day of
  // them, and BYMONTHDAY under FREQ=YEARLY takes its month from DTSTART when
  // no BYMONTH says otherwise.
  return {
    ...slots,
    daysOfMonth,
    months: slots.months.length > 0 ? slots.months : [...MONTHS],
  };
}

/** The weekday a cycle of weeks turns over on, unless it is the default. */
function weekStartOf(anchor: Temporal.PlainDate): Weekday | undefined {
  // Monday is what WKST means when it is left out, so it is left out.
  return WEEKDAYS.find(
    (_, index) => index > 0 && index + 1 === anchor.dayOfWeek,
  );
}
