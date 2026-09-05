/**
 * Which part of a recurrence each term of a rule is.
 *
 * `BYDAY` is the only part two kinds of leaf share, so a term holding two
 * kinds belongs there or nowhere. Everything else is one kind of leaf, and
 * which kind decides which part it fills.
 */

import { type Unwritable, unwritable } from "./export-result.js";
import { type Draft, set, twice } from "./rrule-export-draft.js";
import {
  daySelection,
  daysOfMonthIn,
  isByDay,
  monthsIn,
  windowsIn,
} from "./rrule-export-leaves.js";
import type { DateRangeRule } from "./rule.js";
import type { Term } from "./rule-terms.js";

export function fill(draft: Draft, term: Term): Unwritable | undefined {
  const kinds = new Set(term.map((leaf) => leaf.type));
  if (kinds.size > 1 && !isByDay(kinds)) {
    return unwritable(
      `it unions ${[...kinds].join(" with ")}, and a recurrence's only union is BYDAY`,
    );
  }

  const first = term[0];
  switch (first.type) {
    case "daysOfWeek":
    case "nthDayOfWeekInMonth": {
      return byDay(draft, term);
    }
    case "timeOfDay": {
      return set(draft, "windows", "BYHOUR and BYMINUTE", windowsIn(term));
    }
    case "monthsOfYear": {
      return set(draft, "months", "BYMONTH", monthsIn(term));
    }
    case "daysOfMonth": {
      return set(draft, "daysOfMonth", "BYMONTHDAY", daysOfMonthIn(term));
    }
    case "every": {
      return (
        only(term, "cycles, and a recurrence has one INTERVAL") ??
        set(draft, "every", "INTERVAL", first)
      );
    }
    case "dateRange": {
      return (
        only(term, "date ranges, and a recurrence runs to one last day") ??
        bounds(draft, first)
      );
    }
    case "dates": {
      return unwritable(
        "it names particular dates, and a recurrence describes a pattern. Dates go beside it as RDATE properties",
      );
    }
  }
}

/** Refuses a union of the parts a recurrence only ever holds one of. */
function only(term: Term, named: string): Unwritable | undefined {
  return term.length > 1 ? unwritable(`it is a union of ${named}`) : undefined;
}

function byDay(draft: Draft, term: Term): Unwritable | undefined {
  if (draft.byDay) {
    return twice("BYDAY");
  }

  const selected = daySelection(term);
  draft.byDay = true;
  draft.weekdays = selected.weekdays;
  draft.nths = selected.nths;
  return undefined;
}

function bounds(draft: Draft, rule: DateRangeRule): Unwritable | undefined {
  return (
    (rule.from === undefined
      ? undefined
      : set(draft, "from", "DTSTART", rule.from)) ??
    (rule.to === undefined ? undefined : set(draft, "to", "UNTIL", rule.to))
  );
}
