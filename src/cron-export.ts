/**
 * Writing a Quando rule out as a cron expression.
 *
 * The other direction from [cron.ts](./cron.ts), and a narrower one. A rule
 * can say things cron has no field for, so this answers rather than throws:
 * `ok` is whether the rule has a cron form, and `reason` says what stopped it
 * when it does not.
 *
 * The reading matches the one going in. A cron expression fires in the minutes
 * the rule covers, so a rule covering 09:00 to 09:01 on weekdays is
 * `0 9 * * 1-5`, and one covering the whole of 09:00 to 17:00 is
 * `* 9-16 * * 1-5` — every minute of those hours.
 */

import { cronSlots } from "./cron-export-slots.js";
import { cronText } from "./cron-export-fields.js";
import type { Unwritable } from "./export-result.js";
import type { Rule } from "./rule.js";
import { ruleTerms } from "./rule-terms.js";

/** A rule that has a cron expression. */
export interface WrittenCron {
  readonly ok: true;
  readonly cron: string;
  /** The clock the expression is meant to run on, when the rule names one. */
  readonly zone?: string;
}

export type CronExport = WrittenCron | Unwritable;

/**
 * A rule as a five-field POSIX cron expression, when it has one.
 *
 * ```ts
 * const written = toCron(weekdays().and(timeOfDay("09:00", "09:01")));
 * if (written.ok) {
 *   console.log(written.cron); // 0 9 * * 1-5
 * }
 * ```
 */
export function toCron(rule: Rule): CronExport {
  const read = ruleTerms(rule);
  if (!read.ok) {
    return read;
  }

  const filled = cronSlots(read.terms);
  if (!filled.ok) {
    return filled;
  }

  const written = cronText(filled.slots);
  if (!written.ok) {
    return written;
  }

  return read.zone === undefined
    ? { ok: true, cron: written.cron }
    : { ok: true, cron: written.cron, zone: read.zone };
}
