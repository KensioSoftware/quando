/**
 * The builder for stepping through the calendar a period at a time.
 *
 * The anchor is an option rather than a positional argument, because it reads
 * as a bound otherwise and it is not one. `every(2, "weeks", { anchor })` sets
 * the phase, and `onOrAfter` is what says when the recurrence starts.
 */

import { build, type Built } from "./built-rule.js";
import type { EveryRule, Period } from "./rule.js";
import { asDate, asInterval, asPeriod, asZone } from "./validation.js";

export interface EveryOptions {
  /** The date a cycle lands on, which fixes the phase of all the others. */
  readonly anchor: string;
  readonly zone?: string;
}

/** Every nth period, counted in both directions from the anchor. */
export function every(
  interval: number,
  period: Period,
  options: EveryOptions,
): Built<EveryRule> {
  const every = {
    type: "every",
    interval: asInterval(interval, "interval"),
    period: asPeriod(period, "period"),
    anchor: asDate(options.anchor, "anchor"),
  } as const;

  return build(
    options.zone === undefined
      ? every
      : { ...every, zone: asZone(options.zone, "zone") },
  );
}
