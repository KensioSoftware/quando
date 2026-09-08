/**
 * The sentences the two caps give for one instant.
 *
 * Split from [constraint-match-text.ts](./constraint-match-text.ts), which
 * keeps the dispatch and the spacing account. Both caps name the same window
 * the same two ways, so their wording belongs together.
 */

import { countedFor } from "./constraint-counting.js";
import { occupiedFor } from "./constraint-occupancy.js";
import type { Context } from "./context.js";
import { spelled, spelledDistance } from "./duration-words.js";
import type { Occurrence } from "./occurrence.js";
import type { AtMostRule, AtMostTimeRule, Period } from "./rule.js";

const BUCKET_WORD: Readonly<Record<Period, string>> = {
  days: "day",
  weeks: "week",
  months: "month",
  years: "year",
};

/** Where a cap counts, as a phrase to drop into a sentence. */
function where(rule: AtMostRule | AtMostTimeRule): string {
  return rule.within === undefined
    ? `this ${BUCKET_WORD[rule.per]}`
    : `the ${spelled(Temporal.Duration.from(rule.within))} up to this instant`;
}

/** The sentence a cap on total time gives, naming how much is already used. */
export function describeTimeCap(
  rule: AtMostTimeRule,
  at: Temporal.ZonedDateTime,
  matched: boolean,
  history: readonly Occurrence[],
  read: Omit<Context, "from" | "to"> | undefined,
): string {
  const used = spelledDistance(occupiedFor(rule, at, history, read));
  const cap = spelled(Temporal.Duration.from(rule.total));
  const held = where(rule);
  return matched
    ? `${used} of ${held} is taken up, and at most ${cap} is allowed.`
    : `${used} of ${held} is already taken up, which is the most allowed.`;
}

export function describeCap(
  rule: AtMostRule,
  at: Temporal.ZonedDateTime,
  matched: boolean,
  history: readonly Occurrence[],
  read: Omit<Context, "from" | "to"> | undefined,
): string {
  const seen = countedFor(rule, at, history, read);
  const held = where(rule);
  return matched
    ? `There ${have(seen)} ${occurrences(seen)} in ${held}, and at most ${rule.count} are allowed.`
    : `There ${have(seen)} already ${occurrences(seen)} in ${held}, which is the most allowed.`;
}

function occurrences(count: number): string {
  return count === 1 ? "1 occurrence" : `${count} occurrences`;
}

function have(count: number): string {
  return count === 1 ? "is" : "are";
}
