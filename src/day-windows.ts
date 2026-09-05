/**
 * Time-of-day windows as minutes, and the hours and minutes they factor into.
 *
 * [minute-windows.ts](./minute-windows.ts) goes the other way, building a
 * window out of the hours and minutes a notation names. Coming back, the
 * question is whether a set of minutes *is* such a product: cron's two clock
 * fields select every combination of the hours and the minutes they name, so
 * 09:00 to 17:00 is expressible and 09:30 to 17:30 is not.
 */

import type { TimeOfDayRule } from "./rule.js";

export const MINUTES_IN_AN_HOUR = 60;
export const MINUTES_IN_A_DAY = 24 * MINUTES_IN_AN_HOUR;

/** A stretch of the clock, as the minute it starts at and how long it runs. */
export interface Window {
  readonly start: number;
  readonly length: number;
}

/**
 * The window a rule covers.
 *
 * An end at or before the start runs past midnight, which is what the rule
 * means, so the length is taken the long way round rather than as a
 * subtraction that would come out negative.
 */
export function windowOf(rule: TimeOfDayRule): Window {
  const start = minuteOf(rule.from);
  const end = minuteOf(rule.to);
  return {
    start,
    length: ((end - start + MINUTES_IN_A_DAY - 1) % MINUTES_IN_A_DAY) + 1,
  };
}

/** Every minute of the day the windows cover, sorted, each one once. */
export function minutesOf(windows: readonly Window[]): number[] {
  const covered = new Set<number>();
  for (const window of windows) {
    for (let offset = 0; offset < window.length; offset += 1) {
      covered.add((window.start + offset) % MINUTES_IN_A_DAY);
    }
  }
  return [...covered].toSorted((a, b) => a - b);
}

/** The hours and minutes of a set of minutes of the day. */
export interface ClockParts {
  readonly hours: number[];
  readonly minutes: number[];
}

/**
 * The hours and minutes a set of minutes is the product of, if it is one.
 *
 * Every minute in the set is in the product of its own hours and minutes, so
 * the two are equal exactly when they are the same size. Anything else is a
 * set no pair of clock fields selects.
 */
export function factorsOf(selected: readonly number[]): ClockParts | undefined {
  const parts = {
    hours: sorted(
      selected.map((minute) => Math.floor(minute / MINUTES_IN_AN_HOUR)),
    ),
    minutes: sorted(selected.map((minute) => minute % MINUTES_IN_AN_HOUR)),
  };
  return parts.hours.length * parts.minutes.length === selected.length
    ? parts
    : undefined;
}

/** A minute of the day as a wall clock time: `540` is `"09:00"`. */
export function clockOf(minuteOfDay: number): string {
  const wrapped = minuteOfDay % MINUTES_IN_A_DAY;
  return `${pad(Math.floor(wrapped / MINUTES_IN_AN_HOUR))}:${pad(wrapped % MINUTES_IN_AN_HOUR)}`;
}

function minuteOf(time: string): number {
  const clock = Temporal.PlainTime.from(time);
  return clock.hour * MINUTES_IN_AN_HOUR + clock.minute;
}

function sorted(values: readonly number[]): number[] {
  return [...new Set(values)].toSorted((a, b) => a - b);
}

const pad = (value: number): string => String(value).padStart(2, "0");
