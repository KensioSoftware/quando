/**
 * Sorting a rule's terms into the five things a cron expression can say.
 *
 * Each term has to be one field, or the pair of day fields. What decides which
 * is the kinds of leaf in it, so a term naming two different kinds at once is
 * where most rules stop: cron has exactly one union in it, between the two day
 * fields, and no other place two selections can sit together.
 */

import { type Unwritable, unwritable } from "./export-result.js";
import {
  daysIn,
  isDayTerm,
  minutesIn,
  monthsIn,
  reasonFor,
} from "./cron-export-leaves.js";
import type { Month, Weekday } from "./rule.js";
import type { Term } from "./rule-terms.js";

/** What the five fields select, with an absent slot leaving a field open. */
export interface CronSlots {
  /** Minutes of the day, or nothing at all for every minute. */
  readonly minutes: readonly number[] | undefined;
  readonly months: readonly Month[] | undefined;
  readonly daysOfMonth: readonly number[] | undefined;
  readonly daysOfWeek: readonly Weekday[] | undefined;
  /** Whether the two day fields were a union, which is what cron reads. */
  readonly eitherDay: boolean;
}

interface Filled {
  readonly ok: true;
  readonly slots: CronSlots;
}

interface Draft {
  minutes: readonly number[] | undefined;
  months: readonly Month[] | undefined;
  daysOfMonth: readonly number[] | undefined;
  daysOfWeek: readonly Weekday[] | undefined;
  eitherDay: boolean;
}

export function cronSlots(terms: readonly Term[]): Filled | Unwritable {
  const draft: Draft = {
    minutes: undefined,
    months: undefined,
    daysOfMonth: undefined,
    daysOfWeek: undefined,
    eitherDay: false,
  };

  for (const term of terms) {
    const problem = fill(draft, term);
    if (problem !== undefined) {
      return problem;
    }
  }

  if (
    draft.daysOfMonth !== undefined &&
    draft.daysOfWeek !== undefined &&
    !draft.eitherDay
  ) {
    return unwritable(
      "it needs a day of the month and a day of the week to match together, and cron reads two restricted day fields as either one matching",
    );
  }
  return { ok: true, slots: { ...draft } };
}

function fill(draft: Draft, term: Term): Unwritable | undefined {
  const kinds = new Set(term.map((leaf) => leaf.type));

  if (kinds.size === 1 && kinds.has("timeOfDay")) {
    return set(draft, "minutes", "clock time", minutesIn(term));
  }
  if (kinds.size === 1 && kinds.has("monthsOfYear")) {
    return set(draft, "months", "month field", monthsIn(term));
  }
  if (isDayTerm(kinds)) {
    return days(draft, term, kinds.size === 2);
  }
  return unwritable(reasonFor(kinds));
}

function days(
  draft: Draft,
  term: Term,
  union: boolean,
): Unwritable | undefined {
  const selected = daysIn(term);

  if (selected.ofMonth.some((day) => day < 0)) {
    return unwritable(
      "it counts days back from the end of the month, which POSIX cron cannot say",
    );
  }
  if (union) {
    draft.eitherDay = true;
  }

  return (
    (selected.ofMonth.length === 0
      ? undefined
      : set(draft, "daysOfMonth", "day of the month", selected.ofMonth)) ??
    (selected.ofWeek.length === 0
      ? undefined
      : set(draft, "daysOfWeek", "day of the week", selected.ofWeek))
  );
}

/** The slots a term can fill. `eitherDay` is decided, not selected. */
type Slot = "minutes" | "months" | "daysOfMonth" | "daysOfWeek";

/** Fills one slot, refusing a rule that names the same field twice. */
function set<K extends Slot>(
  draft: Draft,
  slot: K,
  named: string,
  value: NonNullable<Draft[K]>,
): Unwritable | undefined {
  if (draft[slot] !== undefined) {
    return unwritable(`it names the ${named} twice, and cron has one field`);
  }
  draft[slot] = value;
  return undefined;
}
