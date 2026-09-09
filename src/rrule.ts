/**
 * Reading an RFC 5545 recurrence rule as a Quando rule.
 *
 * An RRULE says when something recurs and leans on DTSTART for the rest: the
 * time of day, the day the pattern repeats on when nothing names one, and the
 * point the recurrence begins. So `start` is required here, and it does all
 * three jobs.
 *
 * An occurrence becomes the minute it starts in, the same reading `parseCron`
 * takes. A start with no time of day recurs over whole days instead.
 */

import { all, inZone } from "./build.js";
import { build, type Rule } from "./built-rule.js";
import { fail } from "./parse-shape.js";
import type { RuleData } from "./rule.js";
import { cycleRule } from "./rrule-cycle.js";
import { calendarRules } from "./rrule-calendar.js";
import { periodOf } from "./rrule-frequency.js";
import { rruleParts } from "./rrule-parts.js";
import { timeRule } from "./rrule-time.js";
import { parseUntil } from "./rrule-until.js";
import { onOrAfter, onOrBefore } from "./range-builders.js";
import { asZone } from "./validation.js";
import type { DurationInput } from "./duration-input.js";
import type { WrittenRRule } from "./rrule-export.js";
import { openingHours } from "./opening-hours.js";

export interface RRuleOptions {
  /** DTSTART, as a date or a date and time. Required, the way RFC 5545 is. */
  readonly start: string;
  readonly zone?: string;
  /** Wall-clock length of each occurrence. Defaults to one minute for timed starts. */
  readonly duration?: DurationInput;
}

/**
 * A rule covering the times a recurrence runs.
 *
 * Throws a `TypeError` naming the part at fault, including for the parts that
 * exist and have no rule to map onto.
 */
export function parseRRule(written: WrittenRRule): Rule;
export function parseRRule(text: string, options: RRuleOptions): Rule;
export function parseRRule(
  input: string | WrittenRRule,
  settings?: RRuleOptions,
): Rule {
  const text = typeof input === "string" ? input : input.rrule;
  const options = typeof input === "string" ? settings : input;
  if (options === undefined) {
    return fail("start", "DTSTART is required");
  }
  const zone =
    options.zone === undefined ? undefined : asZone(options.zone, "zone");
  const rule = ruleFor(text, options.start, zone, options.duration);
  return zone === undefined ? build(rule) : inZone(zone, rule);
}

function ruleFor(
  text: string,
  start: string,
  zone: string | undefined,
  duration: DurationInput | undefined,
): RuleData {
  const parts = rruleParts(text);
  const period = periodOf(parts.get("FREQ") ?? "");
  const from = startOf(start);

  const rules: RuleData[] = [
    cycleRule(parts, period, from.date, zone),
    // DTSTART is the first occurrence, so nothing before it is covered. This
    // is the bound `every` deliberately leaves to a rule of its own.
    onOrAfter(from.date.toString()),
    ...calendarRules(parts, period, from.date),
  ];

  const clock = timeRule(parts, from.time, duration);

  const until = parts.get("UNTIL");
  if (until !== undefined) {
    // Timestamp bounds are refused until occurrence timestamps can be preserved.
    rules.push(onOrBefore(parseUntil(until)));
  }

  const days = all(...rules);
  return clock === undefined ? days : openingHours(days, clock);
}

/** DTSTART, as a date and the clock time it carries when it has one. */
function startOf(start: string): {
  date: Temporal.PlainDate;
  time: Temporal.PlainTime | undefined;
} {
  try {
    return {
      date: Temporal.PlainDate.from(start),
      time: start.includes("T")
        ? Temporal.PlainDateTime.from(start).toPlainTime()
        : undefined,
    };
  } catch {
    return fail(
      "start",
      `"${start}" is not a date. Expected something like "2026-03-09" or "2026-03-09T09:00"`,
    );
  }
}
