/**
 * Reading a rule as the times it covers.
 *
 * One function over the whole rule language rather than a method on each rule
 * type, which is what lets the next operation over rules — describing them,
 * validating them, drawing them — be another function here rather than another
 * method everywhere.
 *
 * Everything is clipped to the context's window. That is not tidiness: a
 * composition whose answer is empty has nothing to discover that from, so the
 * only thing that makes it terminate is its sources running out. Clipping at
 * the leaves is what makes them run out.
 */

import { checkWindow } from "./validation.js";
import { contextInZone, type Context, windowOf } from "./context.js";
import {
  clip,
  complement,
  intersect,
  type IntervalStream,
  union,
} from "./interval-stream.js";
import type { Rule } from "./rule.js";
import { dateIntervals, weekdayIntervals } from "./day-rules.js";
import {
  dayOfMonthIntervals,
  monthIntervals,
  nthDayOfWeekInMonthIntervals,
} from "./month-rules.js";
import { timeOfDayIntervals } from "./time-rules.js";

/** All of time, before the window narrows it. */
const UNBOUNDED: IntervalStream = [{ start: undefined, end: undefined }];

/** No time at all. */
const EMPTY: IntervalStream = [];

/**
 * The intervals a rule covers within a context, in order and coalesced.
 *
 * The stream is lazy, and endless when the context has no end and the rule
 * recurs — which is the point. Take what you need from it.
 *
 * Every interval comes back in the context's zone. The algebra compares
 * instants, so a sweep is free to take one interval's start and another's end,
 * and those two may have been written in different zones — a London rule read
 * from a Tokyo context would otherwise hand back an interval whose two halves
 * disagree about what time it is. The instants are unaffected either way; this
 * only settles which zone reads them back.
 */
export function intervals(rule: Rule, context: Context): IntervalStream {
  checkWindow(context.from, context.to);
  return readIn(evaluate(rule, context), context.from.timeZoneId);
}

function* readIn(stream: IntervalStream, zone: string): IntervalStream {
  for (const interval of stream) {
    yield {
      start: interval.start?.withTimeZone(zone),
      end: interval.end?.withTimeZone(zone),
    };
  }
}

function evaluate(rule: Rule, context: Context): IntervalStream {
  const window = windowOf(context);

  switch (rule.type) {
    case "always": {
      return clip(UNBOUNDED, window);
    }

    case "never": {
      return EMPTY;
    }

    case "daysOfWeek": {
      return clip(weekdayIntervals(context, rule.days, rule.zone), window);
    }

    case "daysOfMonth": {
      return clip(dayOfMonthIntervals(context, rule.days, rule.zone), window);
    }

    case "nthDayOfWeekInMonth": {
      return clip(
        nthDayOfWeekInMonthIntervals(context, rule.nth, rule.days, rule.zone),
        window,
      );
    }

    case "monthsOfYear": {
      return clip(monthIntervals(context, rule.months, rule.zone), window);
    }

    case "dates": {
      return clip(dateIntervals(context, rule.dates, rule.zone), window);
    }

    case "timeOfDay": {
      return clip(
        timeOfDayIntervals(context, rule.from, rule.to, rule.zone),
        window,
      );
    }

    case "inZone": {
      return evaluate(rule.rule, contextInZone(context, rule.zone));
    }

    case "all": {
      return everyOf(rule.rules, context);
    }

    case "any": {
      return anyOf(rule.rules, context);
    }

    case "not": {
      // Re-clipped, because a complement is unbounded at both ends by nature
      // and would otherwise reach outside the window it was asked about.
      return clip(complement(evaluate(rule.rule, context)), window);
    }

    default: {
      // Compiles only while every rule type above is handled. Adding one to the
      // union makes this the error that says so.
      const unreachable: never = rule;
      return unreachable;
    }
  }
}

/** Intersection, starting from all of time so that no rules means no limits. */
function everyOf(rules: readonly Rule[], context: Context): IntervalStream {
  let covered = clip(UNBOUNDED, windowOf(context));
  for (const rule of rules) {
    covered = intersect(covered, evaluate(rule, context));
  }
  return covered;
}

/** Union, starting from nothing so that no rules means no times. */
function anyOf(rules: readonly Rule[], context: Context): IntervalStream {
  let covered = EMPTY;
  for (const rule of rules) {
    covered = union(covered, evaluate(rule, context));
  }
  return covered;
}
