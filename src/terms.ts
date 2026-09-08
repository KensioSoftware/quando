/**
 * Reading a rule from a line of terms.
 *
 * The notation is whitespace-separated and additive. Each term narrows what
 * the rule covers, and the order they are written in never matters, so
 * `weekdays 09:00-17:00 @Europe/London` is exactly the three facts it looks
 * like. A union lives inside one term, as `sat,sun`. That is what lets every
 * term between the spaces mean "and this too".
 *
 * **A line is one conjunction.** "Weekdays nine to five, Saturdays ten to two"
 * is two of them, and a cascade is what holds two. Calling `open` twice on a
 * schedule says it, and the notation stays flat because of that. See
 * [docs/terms](../docs/terms/README.md).
 *
 * Reading throws on a term it cannot make sense of. A dropped term is the
 * dangerous failure in this domain, because the rule that comes back is a
 * valid one covering the wrong time, and the first report of it is somebody
 * turning up to a closed door.
 */

import { all, inCalendar, inZone } from "./build.js";
import { build, type Built } from "./built-rule.js";
import type { Rule } from "./rule.js";
import { repeatedTerm, unreadableTerm } from "./terms-errors.js";
import { type Contribution, readQualified } from "./terms-qualified.js";
import { readShape } from "./terms-shapes.js";
import { nearestWord, QUALIFIERS } from "./terms-words.js";

/** What the terms so far have said, as they are folded together. */
interface Reading {
  readonly rules: Rule[];
  zone: string | undefined;
  calendar: string | undefined;
}

/**
 * The rule a line of terms names.
 *
 * ```ts
 * parseTerms("mon-fri 09:00-17:00 @Europe/London except:2026-12-25");
 * ```
 */
export function parseTerms(input: string): Built<Rule> {
  const terms = input.split(/\s+/u).filter((term) => term !== "");
  if (terms.length === 0) {
    throw new RangeError(
      'A rule needs at least one term, as in "weekdays 09:00-17:00".',
    );
  }

  const reading: Reading = { rules: [], zone: undefined, calendar: undefined };
  for (const [index, term] of terms.entries()) {
    add(reading, readTerm(term, `Term ${index + 1}`));
  }
  return assembled(reading);
}

function add(reading: Reading, contribution: Contribution): void {
  if (contribution.rule !== undefined) {
    reading.rules.push(contribution.rule);
  }
  if (contribution.zone !== undefined) {
    if (reading.zone !== undefined) {
      repeatedTerm("zone", reading.zone, contribution.zone);
    }
    reading.zone = contribution.zone;
  }
  if (contribution.calendar !== undefined) {
    if (reading.calendar !== undefined) {
      repeatedTerm("calendar", reading.calendar, contribution.calendar);
    }
    reading.calendar = contribution.calendar;
  }
}

/**
 * The terms as one rule, with the scopes wrapped around the outside.
 *
 * The zone goes outermost so that a calendar inside it is read on the clock
 * the line named. `explainRule` reads a scope in that order too.
 */
function assembled(reading: Reading): Built<Rule> {
  const [only, ...rest] = reading.rules;
  const met =
    only === undefined ? all() : rest.length === 0 ? only : all(only, ...rest);
  const onCalendar =
    reading.calendar === undefined ? met : inCalendar(reading.calendar, met);
  return reading.zone === undefined
    ? build(onCalendar)
    : inZone(reading.zone, onCalendar);
}

/** One term, read as whatever its shape or its qualifier says it is. */
function readTerm(term: string, at: string): Contribution {
  if (term.startsWith("@")) {
    return { zone: term.slice(1) };
  }
  const shape = readShape(term);
  if (shape !== undefined) {
    return { rule: shape };
  }
  refuseNearMiss(term, at);
  return readQualified(term, at, readTerm) ?? unreadableTerm(term, at);
}

/**
 * Refuses a prefix that was nearly a qualifier, before it becomes a rule.
 *
 * `except:holidays` misspelled is otherwise a custom rule named `excpet`, and
 * the complaint about it arrives at evaluation time from somewhere else
 * entirely. This is the one place that knows what was meant.
 */
function refuseNearMiss(term: string, at: string): void {
  const colon = term.indexOf(":");
  if (colon === -1) {
    return;
  }
  const name = term.slice(0, colon);
  if (QUALIFIERS.some((qualifier) => qualifier === name)) {
    return;
  }
  const nearest = nearestWord(name);
  if (nearest !== undefined && QUALIFIERS.some((q) => `${q}:` === nearest)) {
    throw new RangeError(
      `${at}: "${term}" is not a term. Did you mean "${nearest}"?`,
    );
  }
}
