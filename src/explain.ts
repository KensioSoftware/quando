import { asCascade, type Cascade, type CascadeLike } from "./cascade.js";
import type { Context } from "./context.js";
import { explainCascade } from "./explain-cascade.js";
import type { DefaultExplanation, Explanation } from "./explain-types.js";
import { type ExplanationDomain, summary } from "./explanation-text.js";
import { evaluationOptions } from "./evaluation-options.js";
import { resultDescription } from "./explanation-result-text.js";

export type {
  AssignmentStep,
  DefaultExplanation,
  Explanation,
  ExplanationStep,
  ReplacementStep,
  SkippedLayer,
} from "./explain-types.js";
export { explainRule, type RuleExplanation } from "./rule-explanation.js";

/** Explains the value a cascade assigns at one instant. */
export function explain<V>(
  source: CascadeLike<V>,
  at: Temporal.ZonedDateTime,
  context?: Omit<Context, "from" | "to">,
): Explanation<V> {
  return explainCascade(
    asCascade(source),
    at,
    evaluationOptions(source, context ?? {}),
    "",
    "cascade",
  );
}

/** Explains a schedule using opening-hours vocabulary. */
export function explainSchedule(
  source: Cascade<boolean>,
  at: Temporal.ZonedDateTime,
  context?: Omit<Context, "from" | "to">,
): DefaultExplanation<boolean> {
  return withDomainDefault(
    explainCascade(source, at, context, "", "schedule"),
    false,
    at,
    "schedule",
  );
}

/** Explains a rota using assignment vocabulary. */
export function explainRota<V>(
  source: Cascade<V>,
  at: Temporal.ZonedDateTime,
  context?: Omit<Context, "from" | "to">,
): Explanation<V> {
  return explainCascade(source, at, context, "", "rota");
}

/** Explains a tally using totals and contributions. */
export function explainTally(
  source: Cascade<number>,
  at: Temporal.ZonedDateTime,
  context?: Omit<Context, "from" | "to">,
): DefaultExplanation<number> {
  return withDomainDefault(
    explainCascade(source, at, context, "", "tally"),
    0,
    at,
    "tally",
  );
}

function withDomainDefault<V>(
  explanation: Explanation<V>,
  fallback: V,
  at: Temporal.ZonedDateTime,
  domain: ExplanationDomain,
): DefaultExplanation<V> {
  const value = explanation.value ?? fallback;
  return {
    ...explanation,
    value,
    summary: resultDescription(value, at, domain),
    details: summary(value, explanation.steps, explanation.skipped, at, domain),
  };
}
