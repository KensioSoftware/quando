/** The shapes a rota has, kept apart from the code that builds and reads one. */

import type { Cascade } from "./cascade.js";
import type { RuleRegistry } from "./custom-rules.js";
import type { Explanation } from "./explain.js";
import type { JsonCompatible } from "./json.js";
import type { LayerOptions } from "./layer-options.js";
import type { PlainRule } from "./plain-forms.js";
import type { ValidationDiagnostic } from "./semantic-validation.js";
import type { ValuedStream } from "./valued-stream.js";

/** The stored form of a rota. */
export interface RotaData<V> {
  readonly type: "rota";
  readonly cascade: Cascade<V>;
}

/** Assignments over time with methods for rota questions. */
export interface Rota<V> extends RotaData<V> {
  readonly assign: <const W>(
    scope: PlainRule,
    value: W & JsonCompatible<W>,
    options?: LayerOptions,
  ) => Rota<V | W>;
  readonly swap: <const W>(
    day: PlainRule,
    value: W & JsonCompatible<W>,
    options?: LayerOptions,
  ) => Rota<V | W>;
  readonly whoIsOn: (at: Temporal.ZonedDateTime) => V | undefined;
  readonly explain: (at: Temporal.ZonedDateTime) => Explanation<V>;
  readonly shifts: (
    from: Temporal.ZonedDateTime,
    to?: Temporal.ZonedDateTime,
  ) => ValuedStream<V>;
  /**
   * The same rota, reading `custom` rules from this registry.
   *
   * A registry holds functions, so it cannot live in the stored document. It
   * rides beside it, and `toJSON` is unchanged. Calling this twice replaces
   * the registry rather than merging the two.
   */
  readonly withRules: (rules: RuleRegistry) => Rota<V>;

  readonly validate: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
  ) => readonly ValidationDiagnostic[];
  readonly toJSON: () => RotaData<V>;
}

/**
 * `read` is what the rota carries that its document cannot: the registry a
 * `custom` rule in one of its scopes is looked up in. It travels with every
 * derived rota and stays out of `data`, which is what `toJSON` returns.
 */
