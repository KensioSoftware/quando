/**
 * What a constraint says about one instant.
 *
 * The account a constraint gives is the reason these are rules of their own.
 * "Why can I not take another?" is the question people actually have, and
 * answering it means naming the occurrences already counted. Only a rule the
 * library knows about can do that. A custom one gives back its own name.
 */

import { countedFor } from "./constraint-counting.js";
import type { Context } from "./context.js";
import { spelled, spelledDistance } from "./duration-words.js";
import { endOf, type Occurrence } from "./occurrence.js";
import type {
  AtMostRule,
  ConstraintRule,
  Period,
  SpacedByRule,
} from "./rule.js";

const BUCKET_WORD: Readonly<Record<Period, string>> = {
  days: "day",
  weeks: "week",
  months: "month",
  years: "year",
};

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
  return rule.type === "atMost"
    ? describeCap(rule, at, matched, history, read)
    : describeSpacing(rule, at, matched, history);
}

function describeCap(
  rule: AtMostRule,
  at: Temporal.ZonedDateTime,
  matched: boolean,
  history: readonly Occurrence[],
  read: Omit<Context, "from" | "to"> | undefined,
): string {
  const seen = countedFor(rule, at, history, read);
  const where =
    rule.within === undefined
      ? `this ${BUCKET_WORD[rule.per]}`
      : `the ${spelled(Temporal.Duration.from(rule.within))} up to this instant`;
  return matched
    ? `There ${have(seen)} ${occurrences(seen)} in ${where}, and at most ${rule.count} are allowed.`
    : `There ${have(seen)} already ${occurrences(seen)} in ${where}, which is the most allowed.`;
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

function occurrences(count: number): string {
  return count === 1 ? "1 occurrence" : `${count} occurrences`;
}

function have(count: number): string {
  return count === 1 ? "is" : "are";
}

/** How far the closest occurrence is, either side of an instant. */
function nearestGap(
  at: Temporal.ZonedDateTime,
  history: readonly Occurrence[],
): Temporal.Duration | undefined {
  let best: Temporal.Duration | undefined;
  for (const one of history) {
    const finished = endOf(one);
    const gap =
      Temporal.ZonedDateTime.compare(at, finished) >= 0
        ? finished.until(at)
        : at.until(one.at);
    if (best === undefined || Temporal.Duration.compare(gap, best) < 0) {
      best = gap;
    }
  }
  return best;
}
