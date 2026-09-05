/**
 * The parts a rule's terms come to, with the absent ones settled.
 *
 * A term is one part, and which part is
 * [rrule-export-terms.ts](./rrule-export-terms.ts)'s problem. What is left
 * here is the shape the rest of the writing reads: every list present, empty
 * where the rule said nothing, so no caller has to ask twice whether a part is
 * there before asking what is in it.
 */

import type { Unwritable } from "./export-result.js";
import type { Window } from "./day-windows.js";
import { emptyDraft } from "./rrule-export-draft.js";
import { fill } from "./rrule-export-terms.js";
import type { NthDays } from "./rrule-export-leaves.js";
import type { EveryRule, Month, Weekday } from "./rule.js";
import type { Term } from "./rule-terms.js";

export type { NthDays } from "./rrule-export-leaves.js";

/** What the recurrence names, before the frequency fills in what it implies. */
export interface RRuleSlots {
  readonly weekdays: readonly Weekday[];
  readonly nths: readonly NthDays[];
  readonly daysOfMonth: readonly number[];
  readonly months: readonly Month[];
  /** The clock windows it covers, or nothing at all for whole days. */
  readonly windows: readonly Window[] | undefined;
  readonly every: EveryRule | undefined;
  readonly from: string | undefined;
  readonly to: string | undefined;
}

interface Filled {
  readonly ok: true;
  readonly slots: RRuleSlots;
}

export function rruleSlots(terms: readonly Term[]): Filled | Unwritable {
  const draft = emptyDraft();

  for (const term of terms) {
    const problem = fill(draft, term);
    if (problem !== undefined) {
      return problem;
    }
  }

  return {
    ok: true,
    slots: {
      ...draft,
      daysOfMonth: draft.daysOfMonth ?? [],
      months: draft.months ?? [],
    },
  };
}
