/**
 * The `every:` term, which is the one that carries its own anchor.
 *
 * Written as `every:2w@2026-01-05`. The anchor is written out every time,
 * because every other term in the notation means the same thing wherever it
 * appears. A cycle with an implied anchor would name a different set of weeks
 * depending on when the line happened to be read. That is the one way a term
 * could be read twice and mean two things.
 */

import { everyNthPeriod } from "./build.js";
import type { Period, RuleData } from "./rule.js";
import { badTerm } from "./terms-errors.js";

/** The units a cycle can be counted in, written short or long. */
const PERIOD_WORDS: Readonly<Record<string, Period>> = {
  d: "days",
  day: "days",
  days: "days",
  w: "weeks",
  week: "weeks",
  weeks: "weeks",
  mo: "months",
  month: "months",
  months: "months",
  y: "years",
  year: "years",
  years: "years",
};

/**
 * A cycle, as `every:2w@2026-01-05`.
 *
 * The anchor is written rather than defaulted. Every other term in the
 * notation means the same thing wherever it appears, and a cycle with an
 * implied anchor would mean a different set of weeks depending on when the
 * string was read.
 */
export function readCycle(term: string, at: string, value: string): RuleData {
  const parts = value.split("@");
  const [count = "", anchor] = parts;
  if (parts.length !== 2 || anchor === undefined || anchor === "") {
    badTerm(
      term,
      at,
      'needs the date a cycle lands on, as in "every:2w@2026-01-05"',
    );
  }
  // Destructured off an empty array when nothing matched, so the count and
  // the unit are read the one way whether the term was written properly or
  // not, and an unwritten unit finds no period the same as a wrong one.
  const [, digits = "", unit = ""] = /^(\d+)([a-z]+)$/u.exec(count) ?? [];
  const period = PERIOD_WORDS[unit];
  if (period === undefined) {
    badTerm(
      term,
      at,
      'counts in d, w, mo or y, as in "every:2w@2026-01-05". ' +
        '"m" is not one of them, because it reads as minutes as often as months',
    );
  }
  return everyNthPeriod(Number(digits), period, { anchor });
}
