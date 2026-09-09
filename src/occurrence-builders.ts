import { build, type Rule } from "./built-rule.js";
import { asDuration, type DurationInput } from "./duration-input.js";
import type {
  AtMostRule,
  AtMostTimeRule,
  Period,
  SpacedByRule,
} from "./rule.js";
import { asCount, asExactGap, asGap } from "./occurrence-validation.js";
import { asPeriod, asZone } from "./validation.js";

/** Calendar buckets restart at the beginning of each named period. */
export type CalendarPeriod = "day" | "week" | "month" | "year";

/** A cap counts either calendar buckets or rolling windows. */
export type AtMostOptions = {
  readonly zone?: string;
} & (
  | { readonly per: CalendarPeriod; readonly within?: never }
  | { readonly within: DurationInput; readonly per?: never }
);

type CountWindow =
  | { readonly per: Period; readonly within?: undefined }
  | { readonly within: string; readonly per?: undefined };

function countWindow(options: AtMostOptions, exact: boolean): CountWindow {
  if ((options.per === undefined) === (options.within === undefined)) {
    throw new TypeError("A cap needs exactly one of per or within.");
  }
  if (options.per !== undefined) {
    return { per: asPeriod(`${options.per}s`, "per") };
  }
  const duration = asDuration(options.within).toString();
  return {
    within: exact ? asExactGap(duration, "within") : asGap(duration, "within"),
  };
}

function capZone(options: AtMostOptions): { readonly zone?: string } {
  return options.zone === undefined
    ? {}
    : { zone: asZone(options.zone, "zone") };
}

/** Limits the number of occurrences in a calendar bucket or rolling window. */
export function atMostOccurrences(
  count: number,
  options: AtMostOptions,
): Rule<AtMostRule> {
  return build({
    type: "atMost",
    count: asCount(count, "count"),
    ...countWindow(options, false),
    ...capZone(options),
  });
}

/** Limits occupied elapsed time. Overlapping occurrences count once. */
export function atMostOccupiedTime(
  total: DurationInput,
  options: AtMostOptions,
): Rule<AtMostTimeRule> {
  return build({
    type: "atMostTime",
    total: asExactGap(asDuration(total).toString(), "total"),
    ...countWindow(options, true),
    ...capZone(options),
  });
}

/** Requires a gap from one occurrence's end to the next occurrence's start. */
export function minimumGap(gap: DurationInput): Rule<SpacedByRule> {
  return build({
    type: "spacedBy",
    gap: asGap(asDuration(gap).toString(), "gap"),
  });
}
