/**
 * The escape hatch: a rule type an application supplies.
 *
 * Quando's vocabulary names things on a calendar and a clock. Some rules are
 * neither. Easter is a function from a year to a date, sunset is a function of
 * a date and a pair of coordinates, and the start of a lunar month has
 * historically been a matter of observation. All three fit
 * `(context) => intervals` and none of them fit a field on a leaf.
 *
 * **The document stays data.** A `custom` rule is a name and some JSON options,
 * so it stores, travels and canonicalises like every other rule. Only
 * evaluating one needs code, and that code arrives in `context.rules` at the
 * point of asking. That split is what keeps a stored schedule readable by a
 * service that has never heard of Easter, and refusable by name where it
 * matters.
 *
 * There is no module-level default registry. A singleton brings bundler
 * duplication, test pollution and registration-order dependence, and a library
 * that ships no custom rules of its own has nothing to put in one.
 */

import { contextInZone, type Context } from "./context.js";
import { ascending } from "./custom-rule-stream.js";
import { type IntervalStream, union } from "./interval-stream.js";
import type { JsonValue } from "./json.js";
import type { CustomRule } from "./rule.js";

/**
 * What an application supplies to give one `custom` rule a meaning.
 *
 * `intervals` is the same shape the interpreter's own leaves have. It is
 * handed the context to read and the options the rule document carried, and
 * returns the times it covers. Laziness is welcome and not required, because
 * the interpreter clips the result to the window either way.
 */
export interface CustomRuleType {
  /**
   * The times this rule covers within a context.
   *
   * **Must arrive in ascending order of start and must not overlap.** Those
   * two cannot be repaired without buffering the stream, so they are checked
   * and refused. Touching intervals are merged for you.
   */
  readonly intervals: (
    context: Context,
    options: JsonValue | undefined,
  ) => IntervalStream;

  /**
   * A sentence for an explanation, in the present tense, saying what the rule
   * selects. Without one, explanations name the rule and stop.
   */
  readonly describe?: (options: JsonValue | undefined) => string;

  /**
   * The last day this rule type's answers are known for, that day included.
   *
   * A bank holiday table loaded through 2026 returns `"2026-12-31"`, and every
   * query whose answer would depend on 2027 refuses instead of guessing. Where
   * this is absent the rule type vouches for all of time, which is what every
   * rule type did before horizons existed.
   *
   * Read from the registry rather than from the document, because a stored
   * schedule names a rule type without knowing how much of it was loaded.
   */
  readonly known?: (options: JsonValue | undefined) => string | undefined;
}

/**
 * The custom rule types available to a query, by name.
 *
 * A plain object, so composing two sources of rules is a spread and there is
 * nothing to register into or reset between tests.
 *
 * ```ts
 * const rules = { ...bankHolidays, easter };
 * activeAt(schedule, at, { rules });
 * ```
 */
export type RuleRegistry = Readonly<Record<string, CustomRuleType>>;

/** A rule document named a custom rule the registry does not hold. */
export class UnknownCustomRuleError extends Error {
  /** The name the rule document asked for. */
  public readonly ruleName: string;

  public constructor(ruleName: string, known: readonly string[]) {
    const help =
      known.length === 0
        ? "Pass the rule types this document needs as `rules` on the " +
          "context, or with `withRules()` on a schedule, rota or tally."
        : `The context holds ${known.join(", ")}.`;
    super(`No custom rule named "${ruleName}" is registered. ${help}`);
    this.name = "UnknownCustomRuleError";
    this.ruleName = ruleName;
  }
}

/** The type a `custom` rule names, or an error saying what is registered. */
export function customRuleType(
  rule: CustomRule,
  registry: RuleRegistry | undefined,
): CustomRuleType {
  // Own entries only. A registry is an ordinary object, so a rule named
  // "toString" would otherwise find a function on `Object.prototype` and fail
  // somewhere further in with the reason lost.
  const found =
    registry !== undefined && Object.hasOwn(registry, rule.name)
      ? registry[rule.name]
      : undefined;
  if (found === undefined) {
    throw new UnknownCustomRuleError(
      rule.name,
      Object.keys(registry ?? {}).toSorted(),
    );
  }
  return found;
}

/**
 * The times a custom rule covers, read in its own zone and checked.
 *
 * The zone field works the way `inZone` does rather than the way a leaf's own
 * `zone` does. The same instants are handed over displayed in that zone, so a
 * custom rule reads `context.from.timeZoneId` and never has to know the field
 * exists.
 *
 * Clipping to the window stays with the interpreter, which is what keeps a
 * third-party stream from being the reason a query fails to terminate.
 */
export function customIntervals(
  rule: CustomRule,
  context: Context,
): IntervalStream {
  const type = customRuleType(rule, context.rules);
  const read =
    rule.zone === undefined ? context : contextInZone(context, rule.zone);
  return union(ascending(type.intervals(read, rule.options), rule.name), []);
}
