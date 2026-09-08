/**
 * How far an answer is known, and what to do where it runs out.
 *
 * Ask most schedule libraries whether you are open on a Tuesday in 2029 and
 * they say yes, because it is a Tuesday, even though nobody has loaded 2029's
 * holidays. The answer is a guess wearing the clothes of a fact.
 *
 * A horizon is the point past which a subtree stops being evidence. It arrives
 * two ways. A document says it with a `known` rule, and a custom rule type
 * says it from the registry, which is where the realistic case lives: a stored
 * schedule cannot know how far the holiday table it names was loaded, and the
 * code holding that table can.
 */

import { build, type Built } from "./built-rule.js";
import { startOfDay } from "./calendar-walk.js";
import { type Context, zoneOf } from "./context.js";
import type { CustomRule, KnownRule, Rule } from "./rule.js";
import { asDate, asZone } from "./validation.js";

/**
 * Declares how far a subtree's answer is known.
 *
 * ```ts
 * knownThrough("2026-12-31", holidays);
 * ```
 *
 * The named day is included, the way it is in `onOrBefore`. Past it the
 * subtree stops being evidence, and a query whose answer would depend on it
 * refuses rather than guessing.
 */
export function knownThrough(
  through: string,
  rule: Rule,
  zone?: string,
): Built<KnownRule> {
  return build({
    type: "known",
    through: asDate(through, "through"),
    rule,
    ...(zone === undefined ? {} : { zone: asZone(zone, "zone") }),
  });
}

/** The instant a `known` rule stops vouching for what is inside it. */
export function horizonAt(
  rule: KnownRule,
  context: Context,
): Temporal.ZonedDateTime {
  return endOfDay(rule.through, zoneOf(context, rule.zone), context);
}

/**
 * The instant a custom rule stops vouching for itself, if it says.
 *
 * The registry answers, because the document names a rule type without
 * knowing how much of it has been loaded.
 */
export function customHorizonAt(
  rule: CustomRule,
  context: Context,
): Temporal.ZonedDateTime | undefined {
  const declared = context.rules?.[rule.name]?.known?.(rule.options);
  return declared === undefined
    ? undefined
    : endOfDay(declared, zoneOf(context, rule.zone), context);
}

/**
 * The start of the day after the one named, which is where a day ends.
 *
 * Inclusive, the way `onOrBefore` and `dateRange`'s `to` are. Through
 * 2026-12-31 means all of 2026-12-31.
 */
function endOfDay(
  date: string,
  zone: string,
  context: Context,
): Temporal.ZonedDateTime {
  return startOfDay(
    Temporal.PlainDate.from(date).add({ days: 1 }),
    zone,
    context.disambiguation,
  );
}
