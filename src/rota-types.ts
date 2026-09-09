/** The shapes a rota has, kept apart from the code that builds and reads one. */

import type { Cascade } from "./cascade.js";
import type { RuleRegistry } from "./custom-rules.js";
import type { Explanation } from "./explain.js";
import type { JsonCompatible } from "./json.js";
import type { LayerOptions } from "./layer-options.js";
import type { RuleInput } from "./plain-forms.js";
import type {
  ValidationDiagnostic,
  ValidationOptions,
} from "./semantic-validation.js";
import type { ValuedStream } from "./valued-stream.js";
import type { EvaluationOptions } from "./context.js";

/** The local time zone used by rota assignments. */
export interface RotaOptions {
  readonly zone?: string;
}

/** The stored form of a rota. */
export interface RotaData<V> {
  readonly type: "rota";
  readonly cascade: Cascade<V>;
  readonly zone?: string;
}

/** Assignments over time with methods for rota questions. */
export interface Rota<V, Allowed = V> extends RotaData<V> {
  readonly assign: <const W extends Allowed>(
    scope: RuleInput,
    value: W & JsonCompatible<W>,
    options?: LayerOptions,
  ) => Rota<V | W, Allowed>;
  readonly whoIsOn: (
    at: Temporal.ZonedDateTime,
    options?: EvaluationOptions,
  ) => V | undefined;
  readonly explain: (
    at: Temporal.ZonedDateTime,
    options?: EvaluationOptions,
  ) => Explanation<V>;
  readonly shifts: (
    from: Temporal.ZonedDateTime,
    to?: Temporal.ZonedDateTime,
    options?: EvaluationOptions,
  ) => ValuedStream<V>;
  /**
   * The same rota, reading `custom` rules from this registry.
   *
   * A registry holds functions, so it cannot live in the stored document. It
   * rides beside it, and `toJSON` is unchanged. Calling this twice replaces
   * the registry rather than merging the two.
   */
  readonly withCustomRules: (rules: RuleRegistry) => Rota<V, Allowed>;

  readonly validate: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
    options?: EvaluationOptions & ValidationOptions,
  ) => readonly ValidationDiagnostic[];
  readonly toJSON: () => RotaData<V>;
}

/**
 * `read` is what the rota carries that its document cannot: the registry a
 * `custom` rule in one of its scopes is looked up in. It travels with every
 * derived rota and stays out of `data`, which is what `toJSON` returns.
 */
