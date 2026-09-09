import type { Cascade } from "./cascade.js";
import type { Rota } from "./rota-types.js";
import type { EvaluationOptions } from "./context.js";
import { valueAt } from "./value-query.js";
import { explainRota } from "./explain.js";
import { refuse, unknownValueIn } from "./horizon-guard.js";
import { resolve } from "./resolve.js";
import { validate, type ValidationOptions } from "./semantic-validation.js";

/** Creates rota queries using the same evaluation settings. */
export function rotaQueries<V>(
  document: Cascade<V>,
  read?: EvaluationOptions,
): Pick<Rota<V>, "whoIsOn" | "explain" | "shifts" | "validate"> {
  return {
    whoIsOn: (at: Temporal.ZonedDateTime, options?: EvaluationOptions) =>
      valueAt(document, at, { ...read, ...options }),
    explain: (at: Temporal.ZonedDateTime, options?: EvaluationOptions) =>
      explainRota(document, at, { ...read, ...options }),
    shifts: (
      from: Temporal.ZonedDateTime,
      to?: Temporal.ZonedDateTime,
      options?: EvaluationOptions,
    ) => {
      const context =
        to === undefined
          ? { ...read, ...options, from }
          : { ...read, ...options, from, to };
      const fog = unknownValueIn(document, context);
      if (fog !== undefined) {
        refuse("shifts()", fog, context, "unknownValueIntervals()");
      }
      return resolve(document, context);
    },
    validate: (
      from: Temporal.ZonedDateTime,
      to: Temporal.ZonedDateTime,
      options?: EvaluationOptions & ValidationOptions,
    ) =>
      validate(
        document,
        { ...read, ...options, from, to },
        {
          ...options,
          requireFullCoverage: options?.requireFullCoverage ?? true,
        },
      ),
  };
}
