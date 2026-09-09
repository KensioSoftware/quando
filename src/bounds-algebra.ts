/**
 * The walk that carries two bounds through the rule language.
 *
 * Everything here is the algebra in [interval-stream.ts](./interval-stream.ts)
 * applied twice. `all` intersects both bounds, `any` unions both, and `not`
 * swaps them, which is Kleene logic falling out of the shape rather than being
 * written out. [bounds.ts](./bounds.ts) is the surface this answers.
 */

import {
  anyOf,
  beyond,
  certainOf,
  everyOf,
  possibleOf,
  repeatable,
  settled,
  windowOf,
} from "./bounds-parts.js";
import type { Bounds } from "./bounds.js";
import { contextInCalendar, contextInZone } from "./context.js";
import type { Context } from "./context.js";
import { horizonAt } from "./horizon.js";
import { hasHorizon } from "./horizon-shape.js";
import { clip, complement } from "./interval-stream.js";
import type { RuleData } from "./rule.js";
import { beforeShift, shiftedDays } from "./shift-days.js";

/**
 * A rule's bounds, short-circuited when nothing in it can be unknown.
 *
 * The reason a horizon stays opt-in rather than becoming a tax. A subtree with
 * nothing to be unsure about has one answer, and it is read once whichever
 * bound asked for it.
 */
export function boundsOf(rule: RuleData, context: Context): Bounds {
  return hasHorizon(rule, context.rules)
    ? split(rule, context)
    : settled(rule, context);
}

function split(rule: RuleData, context: Context): Bounds {
  switch (rule.type) {
    case "shiftDays": {
      const inner = boundsOf(rule.rule, beforeShift(context, rule.days));
      return {
        certain: repeatable(() => shiftedDays(inner.certain, rule.days)),
        possible: repeatable(() => shiftedDays(inner.possible, rule.days)),
      };
    }
    case "known": {
      return beyond(
        boundsOf(rule.rule, context),
        horizonAt(rule, context),
        context,
      );
    }

    case "inZone": {
      return boundsOf(rule.rule, contextInZone(context, rule.zone));
    }

    case "inCalendar": {
      return boundsOf(rule.rule, contextInCalendar(context, rule.calendar));
    }

    case "all": {
      const parts = rule.rules.map((each) => boundsOf(each, context));
      return {
        certain: repeatable(() => everyOf(parts, context, certainOf)),
        possible: repeatable(() => everyOf(parts, context, possibleOf)),
      };
    }

    case "any": {
      const parts = rule.rules.map((each) => boundsOf(each, context));
      return {
        certain: repeatable(() => anyOf(parts, certainOf)),
        possible: repeatable(() => anyOf(parts, possibleOf)),
      };
    }

    case "not": {
      // Kleene's swap. What is certainly outside a rule is the complement of
      // what it might cover, and what might be outside it is the complement of
      // what it certainly covers.
      const inner = boundsOf(rule.rule, context);
      const window = windowOf(context);
      return {
        certain: repeatable(() => clip(complement(inner.possible), window)),
        possible: repeatable(() => clip(complement(inner.certain), window)),
      };
    }

    // A leaf, which is where a registry horizon lands.
    case "custom":
    case "always":
    case "never":
    case "daysOfWeek":
    case "daysOfMonth":
    case "nthDayOfWeekInMonth":
    case "monthsOfYear":
    case "monthCodes":
    case "every":
    case "timeOfDay":
    case "dates":
    case "dateRange":
    case "atMost":
    case "atMostTime":
    case "spacedBy": {
      return settled(rule, context);
    }
  }
}
