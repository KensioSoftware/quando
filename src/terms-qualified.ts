/**
 * The terms written as `name:value`.
 *
 * A qualifier is what a term reaches for when its shape would otherwise be
 * ambiguous. `15` could be a day of the month or three in the afternoon, so
 * neither reading is offered and `day:15` says which. The same prefix carries
 * a custom rule, so `holidays:gb` names one and hands it its options.
 */

import {
  customRule,
  daysOfMonth,
  monthsOfYear,
  not,
  nthDayOfWeekInMonth,
} from "./build.js";
import { readCycle } from "./terms-cycle.js";
import { MONTHS, type RuleData, WEEKDAYS } from "./rule.js";
import { badTerm, unreadableTerm } from "./terms-errors.js";
import { listed } from "./terms-lists.js";
import { asWeekdayWord } from "./terms-words.js";

/** What one term adds: a rule to meet, or a scope the whole rule is read in. */
export interface Contribution {
  readonly rule?: RuleData;
  readonly zone?: string;
  readonly calendar?: string;
}

/** What a custom rule may be called: a word, the way a registry key is. */
const CUSTOM_NAME = /^[a-z][a-z0-9_-]*$/iu;

/** The rule a `name:value` term names, or `undefined` when it has no colon. */
export function readQualified(
  term: string,
  at: string,
  readTerm: (term: string, at: string) => Contribution,
): Contribution | undefined {
  const colon = term.indexOf(":");
  if (colon === -1) {
    return undefined;
  }
  const name = term.slice(0, colon);
  const value = term.slice(colon + 1);

  switch (name) {
    case "day": {
      return { rule: dayOfMonth(term, at, value) };
    }
    case "month": {
      return { rule: monthNumbers(term, at, value) };
    }
    case "nth": {
      return { rule: nth(term, at, value) };
    }
    case "every": {
      return { rule: readCycle(term, at, value) };
    }
    case "cal": {
      return { calendar: value };
    }
    case "except": {
      return { rule: excluded(term, at, value, readTerm) };
    }
    default: {
      // Anything else names a custom rule, provided the name could be one. A
      // prefix close to one of the words above is caught before this, so what
      // reaches here is either a name the notation has no meaning of its own
      // for or a term that is broken in some way it cannot guess at.
      //
      // The shape is what tells those apart. `09:00-half` is a time range
      // with a typo in it, and reading it as a rule named "09" would be a
      // worse answer than refusing it.
      if (!CUSTOM_NAME.test(name)) {
        unreadableTerm(term, at);
      }
      return {
        rule: value === "" ? customRule(name) : customRule(name, value),
      };
    }
  }
}

function numbers(term: string, at: string, value: string): readonly number[] {
  const found = value.split(",").map(Number);
  if (found.length === 0 || found.some((one) => !Number.isInteger(one))) {
    badTerm(term, at, 'expects whole numbers, as in "day:1,15,-1"');
  }
  return found;
}

function dayOfMonth(term: string, at: string, value: string): RuleData {
  return daysOfMonth(...numbers(term, at, value));
}

function monthNumbers(term: string, at: string, value: string): RuleData {
  const picked = numbers(term, at, value).map((one) => MONTHS[one - 1]);
  if (picked.some((month) => month === undefined)) {
    badTerm(term, at, 'names a month outside 1 to 12, as in "month:3,6"');
  }
  return monthsOfYear(...picked.filter((month) => month !== undefined));
}

/**
 * A weekday by its place in the month, as `nth:1,monday`.
 *
 * The count comes first because that is the order it is said in, and a
 * negative one counts back from the end the way `daysOfMonth` does.
 */
function nth(term: string, at: string, value: string): RuleData {
  const comma = value.indexOf(",");
  if (comma === -1) {
    badTerm(term, at, 'wants a count and a weekday, as in "nth:1,monday"');
  }
  const count = Number(value.slice(0, comma));
  if (!Number.isInteger(count)) {
    badTerm(term, at, 'wants a whole count first, as in "nth:-1,friday"');
  }
  const days = listed(value.slice(comma + 1), WEEKDAYS, asWeekdayWord);
  if (days === undefined || days.length === 0) {
    badTerm(term, at, "names no weekday after the count");
  }
  return nthDayOfWeekInMonth(count, ...days);
}

function excluded(
  term: string,
  at: string,
  value: string,
  readTerm: (term: string, at: string) => Contribution,
): RuleData {
  if (value === "") {
    badTerm(term, at, 'wants something to exclude, as in "except:2026-12-25"');
  }
  const inner = readTerm(value, at);
  if (inner.rule === undefined) {
    badTerm(
      term,
      at,
      "excludes a scope rather than a rule, which covers no time",
    );
  }
  return not(inner.rule);
}
