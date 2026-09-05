/**
 * Turning a set of hours and minutes into the time of day they cover.
 *
 * Cron and RRULE both name the times a thing runs and both fire at an instant,
 * where Quando covers intervals. A firing time becomes the minute that starts
 * there, so 9 o'clock covers 09:00 until 09:01.
 *
 * The hours and minutes are a cross product, and neighbouring minutes are
 * joined, so every minute of the 9 o'clock hour is one window from 09:00 to
 * 10:00 rather than sixty of them.
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

/**
 * Runs of consecutive minutes, as half-open `[from, to)` pairs.
 *
 * A run reaching the end of the day and a run starting at the beginning are
 * left as two. `* 0,23 * * *` becomes 23:00 to 00:00 and 00:00 to 01:00 rather
 * than one window wrapping from 23:00 to 01:00, and the union joins the two
 * where they meet at midnight. Writing the wrap here would move that join
 * earlier and change nothing about the time covered.
 */
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
