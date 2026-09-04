/**
 * Working out which cycle an instant falls in, for the explanation.
 *
 * The counting is [every-periods.ts](./every-periods.ts)'s, the same function
 * the evaluator uses, so the account and the answer cannot disagree.
 */

import { describeEvery } from "./every-explanation-text.js";
import { periodsBetween } from "./every-periods.js";
import type { EveryRule } from "./rule.js";

export function describeEveryMatch(
  rule: EveryRule,
  at: Temporal.ZonedDateTime,
  matched: boolean,
): string {
  const anchor = Temporal.PlainDate.from(rule.anchor);
  return describeEvery(
    rule.interval,
    rule.period,
    rule.anchor,
    periodsBetween(anchor, at.toPlainDate(), rule.period),
    matched,
  );
}
