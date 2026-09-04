/**
 * Turning cron's hour and minute fields into the time of day they cover.
 *
 * Cron fires at an instant and Quando covers intervals, so a firing time
 * becomes the minute that starts there. `0 9 * * *` covers 09:00 until 09:01.
 *
 * The two fields are a cross product, and neighbouring minutes are joined, so
 * `* 9 * * *` is one window from 09:00 to 10:00 rather than sixty of them.
 */

import { any } from "./build.js";
import { timeOfDay } from "./calendar-rules.js";
import { always } from "./build.js";
import type { Rule } from "./rule.js";

const MINUTES_IN_A_DAY = 24 * 60;

/** The minutes of the day the hour and minute fields select together. */
export function coveredMinutes(
  hours: readonly number[],
  minutes: readonly number[],
): number[] {
  const selected: number[] = [];
  for (const hour of hours) {
    for (const minute of minutes) {
      selected.push(hour * 60 + minute);
    }
  }
  return selected.toSorted((a, b) => a - b);
}

/** A rule covering each selected minute, with neighbours joined. */
export function timeOfDayRule(selected: readonly number[]): Rule {
  if (selected.length === MINUTES_IN_A_DAY) {
    // Every minute of the day, which has no pair of clock times to write: a
    // window from 00:00 to 00:00 is the one `timeOfDay` refuses.
    return always();
  }

  const windows = runsOf(selected).map(([from, to]) =>
    timeOfDay(clock(from), clock(to)),
  );

  const only = windows.length === 1 ? windows[0] : undefined;
  return only ?? any(...windows);
}

/** Runs of consecutive minutes, as half-open `[from, to)` pairs. */
function runsOf(selected: readonly number[]): [number, number][] {
  const runs: [number, number][] = [];
  for (const minute of selected) {
    const open = runs.at(-1);
    if (open?.[1] === minute) {
      open[1] = minute + 1;
      continue;
    }
    runs.push([minute, minute + 1]);
  }
  return runs;
}

/**
 * A minute of the day as a wall clock time.
 *
 * Midnight at the end of the day is written `00:00`, and `timeOfDay` reads a
 * window ending before it starts as one that runs past midnight. The last
 * minute of the day is 23:59 to 00:00.
 */
function clock(minuteOfDay: number): string {
  const wrapped = minuteOfDay % MINUTES_IN_A_DAY;
  const hour = Math.floor(wrapped / 60);
  return `${pad(hour)}:${pad(wrapped % 60)}`;
}

const pad = (value: number): string => String(value).padStart(2, "0");
