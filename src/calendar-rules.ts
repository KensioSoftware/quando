import { build, type Built } from "./built-rule.js";
import type {
  DatesRule,
  DaysOfWeekRule,
  TimeOfDayRule,
  Weekday,
} from "./rule.js";
import { asDate, asTime, asZone } from "./validation.js";

/** Whole days, by day of the week. */
export function daysOfWeek(...days: readonly Weekday[]): Built<DaysOfWeekRule> {
  return build({ type: "daysOfWeek", days });
}

/** Monday to Friday. */
export function weekdays(): Built<DaysOfWeekRule> {
  return daysOfWeek("monday", "tuesday", "wednesday", "thursday", "friday");
}

/** Saturday and Sunday. */
export function weekends(): Built<DaysOfWeekRule> {
  return daysOfWeek("saturday", "sunday");
}

/** A wall-clock window within each day. Earlier end times wrap past midnight. */
export function timeOfDay(
  from: string,
  to: string,
  zone?: string,
): Built<TimeOfDayRule> {
  const validFrom = asTime(from, "from");
  const validTo = asTime(to, "to");
  if (Temporal.PlainTime.compare(validFrom, validTo) === 0) {
    throw new RangeError("A time-of-day window must have different endpoints.");
  }
  return build(
    zone === undefined
      ? { type: "timeOfDay", from: validFrom, to: validTo }
      : {
          type: "timeOfDay",
          from: validFrom,
          to: validTo,
          zone: asZone(zone, "zone"),
        },
  );
}

/** Whole days, by date. */
export function dates(...days: readonly string[]): Built<DatesRule> {
  return build({
    type: "dates",
    dates: days.map((day, index) => asDate(day, `dates[${index}]`)),
  });
}
