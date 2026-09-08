/**
 * What a constraint says about one instant.
 *
 * The account a constraint gives is the reason these are rules of their own.
 * "Why can I not take another?" is the question people actually have, and
 * answering it means naming the occurrences already counted. Only a rule the
 * library knows about can do that. A custom one gives back its own name.
 */

import { describeCap, describeTimeCap } from "./constraint-cap-text.js";
import type { Context } from "./context.js";
import { spelled, spelledDistance } from "./duration-words.js";
import { endOf, type Occurrence } from "./occurrence.js";
import type { ConstraintRule, SpacedByRule } from "./rule.js";

/** The sentence a cap or a spacing gives for one instant. */
export function describeConstraintMatch(
  rule: ConstraintRule,
  at: Temporal.ZonedDateTime,
  matched: boolean,
  read: Omit<Context, "from" | "to"> | undefined,
): string {
  // Evaluation runs before the account is written and refuses a missing
  // history there, so by here it is always present.
  const history = read?.occurrences ?? [];
  switch (rule.type) {
    case "atMost": {
      return describeCap(rule, at, matched, history, read);
    }
    case "atMostTime": {
      return describeTimeCap(rule, at, matched, history, read);
    }
    case "spacedBy": {
      return describeSpacing(rule, at, matched, history);
    }
  }
}

function describeSpacing(
  rule: SpacedByRule,
  at: Temporal.ZonedDateTime,
  matched: boolean,
  history: readonly Occurrence[],
): string {
  const least = spelled(Temporal.Duration.from(rule.gap));
  const nearest = nearestGap(at, history);
  if (nearest === undefined) {
    return `Nothing has happened yet, so nothing is within ${least}.`;
  }
  const away = spelledDistance(nearest);
  return matched
    ? `The nearest occurrence is ${away} away, and ${least} is the least allowed.`
    : `The nearest occurrence is ${away} away, which is closer than the ${least} allowed.`;
}

const NO_TIME = Temporal.Duration.from({ seconds: 0 });

/**
 * How far the closest occurrence is, either side of an instant.
 *
 * An instant inside an occurrence that lasted is no distance from it. Reading
 * that case as the distance back to where the occurrence began would give a
 * negative duration, and a negative one sorts below every real gap, so the
 * account would name the wrong occurrence and then print the distance to it
 * as though it were positive.
 */
function nearestGap(
  at: Temporal.ZonedDateTime,
  history: readonly Occurrence[],
): Temporal.Duration | undefined {
  let best: Temporal.Duration | undefined;
  for (const one of history) {
    const gap = distanceTo(at, one);
    if (best === undefined || Temporal.Duration.compare(gap, best) < 0) {
      best = gap;
    }
  }
  return best;
}

function distanceTo(
  at: Temporal.ZonedDateTime,
  one: Occurrence,
): Temporal.Duration {
  if (Temporal.ZonedDateTime.compare(at, one.at) < 0) {
    return at.until(one.at);
  }
  const finished = endOf(one);
  return Temporal.ZonedDateTime.compare(at, finished) >= 0
    ? finished.until(at)
    : NO_TIME;
}
