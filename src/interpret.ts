import { everyOf, anyOf } from "./interpret-compound.js";
import { readIn } from "./interval-presentation.js";
export { readIn } from "./interval-presentation.js";
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
import {
  calendarOf,
  contextInCalendar,
  contextInZone,
  type Context,
  windowOf,
} from "./context.js";
import { calendarIntervals } from "./calendar-intervals.js";
import { customIntervals } from "./custom-rules.js";
import { constraintForbids } from "./occurrence-rules.js";
import { clip, complement, type IntervalStream } from "./interval-stream.js";
import type { RuleData } from "./rule.js";
import { beforeShift, shiftedDays } from "./shift-days.js";
import { refuse, unknownIn } from "./horizon-guard.js";

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
 *
 * The calendar is normalised back the same way and for the same reason. A
 * subtree read on the Hebrew calendar would otherwise hand back instants that
 * print as `[u-ca=hebrew]`, which is a detail of how the rule was written
 * rather than anything about the answer.
 */
export function intervals(rule: RuleData, context: Context): IntervalStream {
  const fog = unknownIn(rule, context);
  if (fog !== undefined) {
    refuse("intervals()", fog, context);
  }
  return assumedIntervals(rule, context);
}

/** Evaluates rule structure while the bounds evaluator handles knowledge. */
export function assumedIntervals(
  rule: RuleData,
  context: Context,
): IntervalStream {
  checkWindow(context.from, context.to);
  return readIn(
    evaluate(rule, context),
    context.from.timeZoneId,
    calendarOf(context),
  );
}

function evaluate(rule: RuleData, context: Context): IntervalStream {
  const window = windowOf(context);

  switch (rule.type) {
    case "always": {
      return clip(UNBOUNDED, window);
    }

    case "never": {
      return EMPTY;
    }

    case "daysOfWeek":
    case "daysOfMonth":
    case "nthDayOfWeekInMonth":
    case "monthsOfYear":
    case "monthCodes":
    case "dates":
    case "every":
    case "dateRange":
    case "timeOfDay": {
      return clip(calendarIntervals(rule, context), window);
    }

    case "atMost":
    case "atMostTime":
    case "spacedBy": {
      // Complemented here, because a constraint is written as what it forbids.
      // An occurrence casts a shadow over the times another may not go, and
      // everything outside every shadow is permitted.
      return clip(complement(constraintForbids(rule, context)), window);
    }

    case "custom": {
      // Clipped here rather than trusted to clip itself. Termination is what
      // clipping buys, and a third-party stream is the one place it cannot be
      // assumed.
      return clip(customIntervals(rule, context), window);
    }

    case "inCalendar": {
      return evaluate(rule.rule, contextInCalendar(context, rule.calendar));
    }

    case "inZone": {
      return evaluate(rule.rule, contextInZone(context, rule.zone));
    }

    case "known": {
      // Passed through, because a horizon says how far the answer is known
      // and nothing about which times are covered. This function answers the
      // second question. `bounds` answers the first. See horizon.ts.
      return evaluate(rule.rule, context);
    }

    case "shiftDays": {
      const before = beforeShift(context, rule.days);
      const original = evaluate(rule.rule, before);
      return clip(shiftedDays(original, rule.days), window);
    }

    case "all": {
      return everyOf(rule.rules, context, evaluate);
    }

    case "any": {
      return anyOf(rule.rules, context, evaluate);
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
