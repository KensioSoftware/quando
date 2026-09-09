/**
 * Checking a whole proposed plan, rather than the next thing on its own.
 *
 * A constraint answers the marginal question. "May I, next, given what has
 * happened?" A plan is a different question, because the things in it feed
 * each other: with a rolling window, each day you plan to travel changes
 * whether the next one is allowed. Asking the rule once about each of them
 * against the history you started with gets the wrong answer, because none of
 * them counts the others.
 *
 * So this walks the plan in order, admitting each occurrence into the history
 * before asking about the one after it. What comes back is the first one the
 * rule refuses, with the rule's own account of why.
 */

import type { Context } from "./context.js";
import { covered } from "./assigned.js";
import { endOf, type Occurrence } from "./occurrence.js";
import { difference } from "./interval-difference.js";
import type { Interval } from "./interval.js";
import { explainRule, type RuleExplanation } from "./rule-explanation.js";
import type { RuleData } from "./rule.js";
import { take } from "./stream.js";
import { withCandidate } from "./plan-context.js";
import { refuse, unknownIn } from "./horizon-guard.js";

/** The first occurrence in a plan that a rule refuses, and why. */
export interface Breach {
  /** Where it sits in the plan as given, whatever order that was in. */
  readonly index: number;
  readonly occurrence: Occurrence;
  /**
   * The instant the rule refused.
   *
   * The occurrence's own start, unless it lasted and ran into refused time
   * partway through.
   */
  readonly at: Temporal.ZonedDateTime;
  /** The rule's account of that instant, against the history by then. */
  readonly explanation: RuleExplanation;
}

/**
 * The first occurrence in a plan the rule refuses, or nothing where it holds
 * throughout.
 *
 * ```ts
 * firstBreach(schengen, trips, { occurrences: alreadyTravelled });
 * ```
 *
 * The plan is read in time order whatever order it arrives in, and each
 * occurrence is admitted into the history before the next is asked about. The
 * history the context carries is where it starts from, and the same rules
 * apply to it: leaving `occurrences` out throws where the rule counts what has
 * happened, because a plan checked against a history nobody supplied would
 * report a fifth dose as fine.
 */
export function firstBreach(
  rule: RuleData,
  plan: readonly Occurrence[],
  context?: Omit<Context, "from" | "to">,
): Breach | undefined {
  // Absent stays absent. Defaulting to an empty history here would answer a
  // constraint permissively for a caller who never said what had happened,
  // which is the failure `occurrences` exists to prevent.
  const admitted =
    context?.occurrences === undefined ? undefined : [...context.occurrences];

  for (const [index, occurrence] of inTimeOrder(plan)) {
    const read = withCandidate(
      {
        ...context,
        ...(admitted === undefined ? {} : { occurrences: [...admitted] }),
      },
      occurrence,
    );
    const refused = refusedIn(rule, occurrence, read);
    if (refused !== undefined) {
      return {
        index,
        occurrence,
        at: refused,
        explanation: explainRule(rule, refused, read),
      };
    }
    admitted?.push(occurrence);
  }
  return undefined;
}

/** Whether a rule allows a whole plan. {@link firstBreach} says what failed. */
export function allowsPlan(
  rule: RuleData,
  plan: readonly Occurrence[],
  context?: Omit<Context, "from" | "to">,
): boolean {
  return firstBreach(rule, plan, context) === undefined;
}

/**
 * The first instant of an occurrence the rule does not cover.
 *
 * A whole occurrence has to be allowed, not only the moment it opens. A trip
 * that runs into a closed stretch on its third day is refused on its third
 * day, and the instant that comes back is the one to tell somebody about.
 */
function refusedIn(
  rule: RuleData,
  occurrence: Occurrence,
  read: Omit<Context, "from" | "to">,
): Temporal.ZonedDateTime | undefined {
  const from = occurrence.at;
  const to = endOf(occurrence);

  // A moment covers no time, so there is no span to look for a gap in. The
  // smallest window there is answers it instead.
  const window: Context =
    Temporal.ZonedDateTime.compare(from, to) === 0
      ? { ...read, from, to: from.add({ nanoseconds: 1 }) }
      : { ...read, from, to };

  const whole: Interval = { start: window.from, end: window.to };
  const fog = unknownIn(rule, window);
  if (fog !== undefined) {
    refuse("allowsPlan()", fog, window);
  }
  const [gap] = take(difference([whole], covered(rule, window)), 1);
  return gap?.start;
}

/** The plan in time order, each paired with where it was given. */
function inTimeOrder(
  plan: readonly Occurrence[],
): readonly (readonly [number, Occurrence])[] {
  return [...plan.entries()].toSorted(([, left], [, right]) =>
    Temporal.ZonedDateTime.compare(left.at, right.at),
  );
}
