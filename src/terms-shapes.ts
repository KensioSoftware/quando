/**
 * The terms whose shape says what they are, with no qualifier in front.
 *
 * A term with no position to sit in has only its own form to say what it
 * means, so each of these is written to be unmistakable. `09:00-17:00` holds a
 * colon, `2026-06-15` opens with four digits, and `mon-fri` is letters.
 * A term whose meaning would depend on where it was written takes a qualifier
 * instead. That is what keeps `15` from being a day of the month on Tuesdays
 * and an hour on Wednesdays.
 */

import { always, any, never } from "./build.js";
import { daysOfWeek, dates, timeOfDay, weekdays, weekends } from "./build.js";
import { monthCodes, monthsOfYear } from "./build.js";
import { between, onOrAfter, onOrBefore } from "./build.js";
import { MONTH_CODES, MONTHS, type Rule, WEEKDAYS } from "./rule.js";
import { listed } from "./terms-lists.js";
import { asMonthWord, asWeekdayWord } from "./terms-words.js";

const KEYWORD_RULES = {
  weekdays,
  weekends,
  always,
  never,
} as const;

const TIME = String.raw`\d{1,2}:\d{2}(?::\d{2})?`;
const TIME_RANGE = new RegExp(`^${TIME}-${TIME}$`, "u");
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const DATE_LIST = /^\d{4}-\d{2}-\d{2}(?:,\d{4}-\d{2}-\d{2})*$/u;

/** The rule a bare term names, or `undefined` when its shape says nothing. */
export function readShape(term: string): Rule | undefined {
  return (
    keyword(term) ??
    hours(term) ??
    dateRange(term) ??
    days(term) ??
    codes(term) ??
    weekdayList(term) ??
    monthList(term)
  );
}

function keyword(term: string): Rule | undefined {
  const said = term.toLowerCase();
  const found = Object.hasOwn(KEYWORD_RULES, said)
    ? KEYWORD_RULES[said as keyof typeof KEYWORD_RULES]
    : undefined;
  return found?.();
}

/**
 * One or more windows in the day, as `09:00-12:00,14:00-17:00`.
 *
 * A comma unions them the way it does everywhere else in the notation. That is
 * what says a lunch break in one term. Two separate terms would ask for the
 * times in both windows, and there are none.
 *
 * An hour written singly is padded, because `9:00` is what a person types and
 * `Temporal` wants the zero.
 */
function hours(term: string): Rule | undefined {
  const parts = term.split(",");
  if (!parts.every((part) => TIME_RANGE.test(part))) {
    return undefined;
  }
  const windows = parts.map((part) => {
    const [from = "", to = ""] = part.split("-");
    return timeOfDay(padded(from), padded(to));
  });
  const [only, ...rest] = windows;
  return only === undefined || rest.length === 0 ? only : any(only, ...rest);
}

function padded(time: string): string {
  return time.length < 5 ? `0${time}` : time;
}

/**
 * A stretch between two dates, open at either end.
 *
 * `..` separates the ends, because a date already holds two dashes and
 * `2026-01-01-2026-12-31` reads as neither one date nor two.
 */
function dateRange(term: string): Rule | undefined {
  if (!term.includes("..")) {
    return undefined;
  }
  const [from = "", to = ""] = term.split("..");
  if (from !== "" && !DATE.test(from)) {
    return undefined;
  }
  if (to !== "" && !DATE.test(to)) {
    return undefined;
  }
  if (from === "") {
    return to === "" ? undefined : onOrBefore(to);
  }
  return to === "" ? onOrAfter(from) : between(from, to);
}

function days(term: string): Rule | undefined {
  return DATE_LIST.test(term) ? dates(...term.split(",")) : undefined;
}

function codes(term: string): Rule | undefined {
  const found = listed(term, MONTH_CODES, (word) => {
    const said = `M${word.slice(1).toUpperCase()}`;
    return MONTH_CODES.find((code) => code === said);
  });
  return found === undefined || found.length === 0
    ? undefined
    : monthCodes(...found);
}

function weekdayList(term: string): Rule | undefined {
  const found = listed(term, WEEKDAYS, asWeekdayWord);
  return found === undefined || found.length === 0
    ? undefined
    : daysOfWeek(...found);
}

function monthList(term: string): Rule | undefined {
  const found = listed(term, MONTHS, asMonthWord);
  return found === undefined || found.length === 0
    ? undefined
    : monthsOfYear(...found);
}
