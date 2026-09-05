/**
 * Writing a Quando rule out as an RFC 5545 recurrence rule.
 *
 * The other direction from [rrule.ts](./rrule.ts), and a narrower one. A rule
 * can say things no recurrence can, so this answers rather than throws: `ok`
 * is whether the rule has a recurrence form, and `reason` says what stopped it
 * when it does not.
 *
 * A recurrence on its own is only part of a calendar entry, so the answer is
 * three values. `start` is DTSTART, which every recurrence needs and which
 * carries the time of day. `duration` is how long one occurrence runs, which
 * an RRULE never says and DTEND or DURATION beside it does.
 */

import type { Unwritable } from "./export-result.js";
import type { Rule } from "./rule.js";
import { ruleTerms } from "./rule-terms.js";
import { boundsOf } from "./rrule-export-start.js";
import { frequencyOf } from "./rrule-export-frequency.js";
import { rruleText } from "./rrule-export-parts.js";
import { rruleSlots } from "./rrule-export-slots.js";
import { clockPartsOf } from "./rrule-export-time.js";

export interface ToRRuleOptions {
  /**
   * Where the recurrence begins, used only when the rule does not say.
   *
   * A date. The time of day comes from the rule, because that is the part of
   * DTSTART a rule can express.
   */
  readonly start?: string;
}

/** A rule that has a recurrence rule, with the rest of its calendar entry. */
export interface WrittenRRule {
  readonly ok: true;
  /** The RRULE value, without the `RRULE:` prefix. */
  readonly rrule: string;
  /** DTSTART, in the form `parseRRule` takes it back in. */
  readonly start: string;
  /** How long one occurrence runs, as an ISO 8601 duration. */
  readonly duration: string;
  /** The clock the recurrence runs on, when the rule names one. */
  readonly zone?: string;
}

export type RRuleExport = WrittenRRule | Unwritable;

/**
 * A rule as an RFC 5545 recurrence, when it has one.
 *
 * ```ts
 * const written = toRRule(weekdays().and(timeOfDay("09:00", "17:00")), {
 *   start: "2026-03-30",
 * });
 * if (written.ok) {
 *   console.log(written.rrule); // FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR
 *   console.log(written.start); // 2026-03-30T09:00
 *   console.log(written.duration); // PT8H
 * }
 * ```
 *
 * Throws a `RangeError` for a `start` that is not a date, the way the rule
 * builders do. A rule that simply has no recurrence form comes back with
 * `ok: false` instead.
 */
export function toRRule(rule: Rule, options: ToRRuleOptions = {}): RRuleExport {
  const read = ruleTerms(rule);
  if (!read.ok) {
    return read;
  }

  const filled = rruleSlots(read.terms);
  if (!filled.ok) {
    return filled;
  }

  const frequency = frequencyOf(filled.slots);
  if (!frequency.ok) {
    return frequency;
  }

  const clock = clockPartsOf(frequency.slots.windows);
  if (!clock.ok) {
    return clock;
  }

  const bounds = boundsOf(
    frequency.slots,
    clock.time,
    read.zone,
    options.start,
  );
  if (!bounds.ok) {
    return bounds;
  }

  const written = {
    ok: true,
    rrule: rruleText(frequency, clock, bounds.until),
    start: bounds.start,
    duration: clock.duration,
  } as const;

  return read.zone === undefined ? written : { ...written, zone: read.zone };
}
