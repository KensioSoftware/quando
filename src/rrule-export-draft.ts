/**
 * The recurrence's parts while they are being filled in.
 *
 * Every part starts absent, and filling one that is already there is refused
 * rather than allowed to overwrite. Two rules asking for the same part is a
 * rule that does not have a recurrence, and quietly keeping one of them would
 * write out a recurrence the rule never meant.
 */

import { type Unwritable, unwritable } from "./export-result.js";
import type { Window } from "./day-windows.js";
import type { NthDays } from "./rrule-export-leaves.js";
import type { EveryRule, Month, Weekday } from "./rule.js";

export interface Draft {
  weekdays: readonly Weekday[];
  nths: readonly NthDays[];
  byDay: boolean;
  daysOfMonth: readonly number[] | undefined;
  months: readonly Month[] | undefined;
  windows: readonly Window[] | undefined;
  every: EveryRule | undefined;
  from: string | undefined;
  to: string | undefined;
}

export function emptyDraft(): Draft {
  return {
    weekdays: [],
    nths: [],
    byDay: false,
    daysOfMonth: undefined,
    months: undefined,
    windows: undefined,
    every: undefined,
    from: undefined,
    to: undefined,
  };
}

/** The parts one rule can fill. `byDay` is filled by a path of its own. */
export type Slot =
  | "daysOfMonth"
  | "months"
  | "windows"
  | "every"
  | "from"
  | "to";

export function set<K extends Slot>(
  draft: Draft,
  slot: K,
  named: string,
  value: NonNullable<Draft[K]>,
): Unwritable | undefined {
  if (draft[slot] !== undefined) {
    return twice(named);
  }
  draft[slot] = value;
  return undefined;
}

export function twice(named: string): Unwritable {
  return unwritable(`it names ${named} twice, and a recurrence names it once`);
}
