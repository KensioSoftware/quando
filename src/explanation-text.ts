import type { Cascade, Layer } from "./cascade.js";
import { annotationDescription } from "./annotation-explanation-text.js";
import type { ExplanationStep, SkippedLayer } from "./explain-types.js";
import { formatValue, resultDescription } from "./explanation-result-text.js";
import type { RuleExplanation } from "./rule-explanation.js";

export type ExplanationDomain = "cascade" | "schedule" | "rota" | "tally";

/** Writes the complete readable explanation for one resolved value. */
export function summary<V>(
  value: V | undefined,
  steps: readonly ExplanationStep<V>[],
  skipped: readonly SkippedLayer[],
  at: Temporal.ZonedDateTime,
  domain: ExplanationDomain,
): string {
  const result = resultDescription(value, at, domain);
  if (steps.length === 0 && skipped.length === 0) {
    return `${result} No layer exists to assign a value.`;
  }
  return [
    result,
    ...steps.flatMap((step) => stepDescriptions(step)),
    ...skipped.map(({ description }) => description),
  ].join(" ");
}

/** Writes what one assignment contributed to its cascade. */
export function assignmentDescription<V>(
  layer: Extract<Layer<V>, { readonly value: V }>,
  match: RuleExplanation,
  previous: V | undefined,
  result: V,
  merge: NonNullable<Cascade<V>["merge"]> | "override",
  domain: ExplanationDomain,
): string {
  const context = annotationDescription(layer);
  const effect = assignmentEffect(layer.value, previous, result, merge, domain);
  return [context, match.description, effect].filter(Boolean).join(" ");
}

/** Writes what one matching replacement did to lower layers. */
export function replacementDescription<V>(
  layer: Extract<Layer<V>, { readonly replace: Cascade<V> }>,
  match: RuleExplanation,
  domain: ExplanationDomain,
): string {
  const context = annotationDescription(layer);
  const noun = domain === "cascade" ? "layers" : `${domain} layers`;
  return [
    context,
    match.description,
    `This layer replaces lower-priority ${noun}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function stepDescriptions<V>(step: ExplanationStep<V>): readonly string[] {
  if (step.type === "assignment") {
    return [step.description];
  }
  return [
    step.description,
    ...step.explanation.steps.flatMap(stepDescriptions),
    ...step.explanation.skipped.map(({ description }) => description),
  ];
}

function assignmentEffect<V>(
  value: V,
  previous: V | undefined,
  result: V,
  merge: NonNullable<Cascade<V>["merge"]> | "override",
  domain: ExplanationDomain,
): string {
  if (domain === "schedule") {
    return scheduleEffect(value === true, previous as boolean | undefined);
  }
  if (domain === "rota") {
    return previous === undefined
      ? `This layer assigns ${formatValue(value)}.`
      : `This higher-priority layer changes the assignment from ${formatValue(previous)} to ${formatValue(value)}.`;
  }
  if (domain === "tally" && merge === "sum") {
    return `This layer adds ${formatValue(value)}. The running total is ${formatValue(result)}.`;
  }
  if (domain === "tally") {
    return `This layer sets the total to ${formatValue(result)}.`;
  }
  if (merge === "override") {
    return previous === undefined
      ? `This layer sets the value to ${formatValue(result)}.`
      : `This higher-priority layer changes the value from ${formatValue(previous)} to ${formatValue(result)}.`;
  }
  return `This layer merges ${formatValue(value)} using ${merge}. The running result is ${formatValue(result)}.`;
}

function scheduleEffect(open: boolean, previous: boolean | undefined): string {
  const state = open ? "open" : "closed";
  if (previous === undefined) {
    return `This layer makes the schedule ${state}.`;
  }
  const earlier = previous ? "open" : "closed";
  if (earlier === state) {
    return `This layer keeps the schedule ${state}.`;
  }
  return `This higher-priority layer changes the schedule from ${earlier} to ${state}.`;
}
