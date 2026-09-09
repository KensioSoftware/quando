import type { EvaluationOptions } from "./context.js";
import type { Occurrence } from "./occurrence.js";

const candidate = Symbol("planned occurrence");
type PlanContext = EvaluationOptions & { readonly [candidate]?: Occurrence };

/** Makes the proposed occurrence available to duration constraints. */
export function withCandidate(
  options: EvaluationOptions,
  occurrence: Occurrence,
): EvaluationOptions {
  const context: PlanContext = { ...options, [candidate]: occurrence };
  return context;
}

/** Returns the candidate while a whole plan is being checked. */
export function plannedOccurrence(
  options: EvaluationOptions,
): Occurrence | undefined {
  return (options as PlanContext)[candidate];
}
