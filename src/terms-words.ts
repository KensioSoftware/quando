/**
 * The words a term can be written with, and what to say about one that misses.
 *
 * A term is refused rather than ignored when it cannot be read. Dropping it
 * silently is the dangerous failure here: `weekdays 09:00-17:00 excpet:holidays`
 * would parse to a schedule open on Christmas and say nothing about it. So
 * every word that misses comes back with the nearest one that would have hit.
 */

import { MONTHS, type Month, WEEKDAYS, type Weekday } from "./rule.js";

/**
 * Reads a weekday, written in full or as exactly its first three letters.
 *
 * The abbreviation is matched against the whole word rather than against the
 * front of it. Matching a prefix would read "monkey" as Monday, and a term
 * that reads as something the writer did not mean is worse than one refused.
 */
export function asWeekdayWord(word: string): Weekday | undefined {
  const said = word.toLowerCase();
  return WEEKDAYS.find((day) => day === said || day.slice(0, 3) === said);
}

/** Reads a month, written in full or as exactly its first three letters. */
export function asMonthWord(word: string): Month | undefined {
  const said = word.toLowerCase();
  return MONTHS.find((month) => month === said || month.slice(0, 3) === said);
}

/** The bare words that stand for a rule on their own. */
export const KEYWORDS = ["weekdays", "weekends", "always", "never"] as const;

/** The `name:value` prefixes the notation reserves for itself. */
export const QUALIFIERS = [
  "day",
  "nth",
  "every",
  "cal",
  "except",
  "month",
] as const;

/** Every word a term could have meant, for suggesting one back. */
function known(): readonly string[] {
  return [
    ...KEYWORDS,
    ...WEEKDAYS,
    ...MONTHS,
    ...QUALIFIERS.map((name) => `${name}:`),
  ];
}

/**
 * How many single-character edits apart two words are.
 *
 * Only ever asked about a word a person typed against one the notation knows.
 * The quadratic space is a handful of bytes at that size, and the plain form
 * of the algorithm is the right one.
 *
 * Every number it reads comes from `entries()` or from a local, so every index
 * it uses is one the array holds. The character read by index is allowed to
 * miss. A character past the end fails the comparison, which is the answer
 * wanted.
 */
function editDistance(left: string, right: string): number {
  const target = Array.from(right);
  let previous = target.map((_, index) => index + 1);
  let done = 0;
  // The answer already, for a left word with no letters in it. Each pass then
  // opens by setting it to the answer for a right word with none.
  let nearest = target.length;

  for (const source of left) {
    const row: number[] = [];
    let diagonal = done;
    done += 1;
    nearest = done;
    for (const [index, above] of previous.entries()) {
      nearest = Math.min(
        diagonal + (source === target[index] ? 0 : 1),
        nearest + 1,
        above + 1,
      );
      row.push(nearest);
      diagonal = above;
    }
    previous = row;
  }
  return nearest;
}

/**
 * The word this one was probably meant to be, if any is close enough.
 *
 * A third of the word's length, so short words need a near-exact match and
 * longer ones can carry a typo or two. Nothing close enough means the term is
 * something else entirely and a suggestion would mislead.
 */
export function nearestWord(word: string): string | undefined {
  const said = word.toLowerCase();
  const limit = Math.max(1, Math.floor(said.length / 3));
  let best: string | undefined;
  let bestDistance = limit + 1;
  for (const candidate of known()) {
    const distance = editDistance(said, candidate.replace(":", ""));
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}
