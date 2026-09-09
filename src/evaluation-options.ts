import type { EvaluationOptions } from "./context.js";

const attached = new WeakMap<object, EvaluationOptions>();

/** Carries executable evaluation settings without serializing them. */
export function withEvaluationOptions<T extends object>(
  source: T,
  options: EvaluationOptions | undefined,
): T {
  if (options !== undefined) {
    attached.set(source, options);
  }
  return source;
}

/** Explicit query settings override settings attached to the source. */
export function evaluationOptions<T extends EvaluationOptions>(
  source: object,
  options: T,
): T {
  return { ...attached.get(source), ...options };
}
