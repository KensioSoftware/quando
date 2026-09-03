import { valueAt } from "./assigned.js";
import { type Cascade, cascade, layer } from "./cascade.js";
import { explain, type Explanation } from "./explain.js";
import { withMethods } from "./fluent.js";
import type { JsonCompatible } from "./json.js";
import { parseCascade, type ValueParser } from "./parse-cascade.js";
import { asDays, type PlainRule } from "./plain-forms.js";
import { resolve } from "./resolve.js";
import { type ValidationDiagnostic, validate } from "./semantic-validation.js";
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
  ) => Rota<V | W>;
  readonly swap: <const W>(
    day: PlainRule,
    value: W & JsonCompatible<W>,
  ) => Rota<V | W>;
  readonly whoIsOn: (at: Temporal.ZonedDateTime) => V | undefined;
  readonly explain: (at: Temporal.ZonedDateTime) => Explanation<V>;
  readonly shifts: (
    from: Temporal.ZonedDateTime,
    to?: Temporal.ZonedDateTime,
  ) => ValuedStream<V>;
  readonly validate: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
  ) => readonly ValidationDiagnostic[];
  readonly toJSON: () => RotaData<V>;
}

function build<V>(data: RotaData<V>): Rota<V> {
  const append = <W>(
    scope: PlainRule,
    value: W & JsonCompatible<W>,
  ): Rota<V | W> => {
    const next = layer(asDays(scope), value);
    const document = cascade<V | W>(...data.cascade.layers, next);
    return build({ type: "rota", cascade: document });
  };

  return withMethods(data, {
    assign: <W>(scope: PlainRule, value: W & JsonCompatible<W>) =>
      append(scope, value),
    swap: <W>(day: PlainRule, value: W & JsonCompatible<W>) =>
      append(day, value),
    whoIsOn: (at: Temporal.ZonedDateTime) => valueAt(data.cascade, at),
    explain: (at: Temporal.ZonedDateTime) => explain(data.cascade, at),
    shifts: (from: Temporal.ZonedDateTime, to?: Temporal.ZonedDateTime) =>
      resolve(data.cascade, to === undefined ? { from } : { from, to }),
    validate: (from: Temporal.ZonedDateTime, to: Temporal.ZonedDateTime) =>
      validate(data.cascade, { from, to }, { requireFullCoverage: true }),
    toJSON: () => ({ ...data }),
  });
}

/** Creates an empty rota. */
export function rota<V = never>(): Rota<V> {
  return build({ type: "rota", cascade: cascade<V>() });
}

/** Reads a stored rota and restores its methods. */
export function parseRota<V>(
  value: unknown,
  parseValue: ValueParser<V>,
  path = "rota",
): Rota<V> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${path}: expected a rota object.`);
  }
  const node = value as Record<string, unknown>;
  if (node["type"] !== "rota") {
    throw new TypeError(`${path}.type: expected "rota".`);
  }
  const unknown = Object.keys(node).find(
    (field) => !["type", "cascade"].includes(field),
  );
  if (unknown !== undefined) {
    throw new TypeError(`${path}.${unknown}: unknown rota field.`);
  }
  const document = parseCascade(node["cascade"], parseValue, `${path}.cascade`);
  if (document.merge !== undefined && document.merge !== "override") {
    throw new TypeError(`${path}.cascade.merge: a rota uses override.`);
  }
  return build({ type: "rota", cascade: document });
}
