import { WEEKDAYS, type Weekday } from "./rule.js";

/** Describes a day-of-week match in calendar terms. */
export function describeDay(
  days: readonly Weekday[],
  at: Temporal.ZonedDateTime,
): string {
  const day = WEEKDAYS[at.dayOfWeek - 1] ?? "monday";
  const name = title(day);
  const matched = days.includes(day);
  if (days.length === 0) {
    return "No weekdays are listed.";
  }
  if (sameDays(days, WEEKDAYS.slice(0, 5))) {
    return `${name} ${matched ? "is" : "is not"} a weekday.`;
  }
  if (sameDays(days, WEEKDAYS.slice(5))) {
    return `${name} ${matched ? "is" : "is not"} a weekend day.`;
  }
  return `${name} ${matched ? "is" : "is not"} included in ${join(days.map((value) => title(value)))}.`;
}

/** Describes a date-list match in calendar terms. */
export function describeDate(
  dates: readonly string[],
  at: Temporal.ZonedDateTime,
  matched: boolean,
): string {
  const date = at.toPlainDate().toString();
  if (dates.length === 0) {
    return "No dates are listed.";
  }
  if (dates.length === 1) {
    return `The date ${matched ? "is" : "is not"} ${dates[0]}.`;
  }
  const choices =
    dates.length <= 3 ? join(dates) : `${dates.length} listed dates`;
  return `${date} ${matched ? "is" : "is not"} one of ${choices}.`;
}

/** Describes a daily time-window match in clock terms. */
export function describeTime(
  from: string,
  to: string,
  at: Temporal.ZonedDateTime,
  matched: boolean,
): string {
  const time = clockTime(at);
  const overnight =
    Temporal.PlainTime.compare(from, to) > 0 ? " overnight" : "";
  return `${time} falls ${matched ? "within" : "outside"} the${overnight} ${from}-${to} window.`;
}

function clockTime(at: Temporal.ZonedDateTime): string {
  const time = at.toPlainTime();
  if (
    time.second === 0 &&
    time.millisecond === 0 &&
    time.microsecond === 0 &&
    time.nanosecond === 0
  ) {
    return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
  }
  return time.toString();
}

function sameDays(
  left: readonly Weekday[],
  right: readonly Weekday[],
): boolean {
  return (
    left.length === right.length &&
    left.every((day, index) => day === right[index])
  );
}

function title(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function join(values: readonly string[]): string {
  if (values.length < 2) {
    return values[0] ?? "no days";
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}
