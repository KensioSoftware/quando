import { valueAt } from "./assigned.js";
import { cascade, layer } from "./cascade.js";
import type { Context } from "./context.js";
import type { RuleRegistry } from "./custom-rules.js";
import { explainRota } from "./explain.js";
import { withMethods } from "./fluent.js";
import type { JsonCompatible } from "./json.js";
import type { LayerOptions } from "./layer-options.js";
import { parseCascade, type ValueParser } from "./parse-cascade.js";
import { asDays, type PlainRule } from "./plain-forms.js";
import { resolve } from "./resolve.js";
import type { Rota, RotaData } from "./rota-types.js";
import { validate } from "./semantic-validation.js";

export type { Rota, RotaData } from "./rota-types.js";

function build<V>(
  data: RotaData<V>,
  read?: Omit<Context, "from" | "to">,
): Rota<V> {
  const append = <W>(
    scope: PlainRule,
    value: W & JsonCompatible<W>,
    options?: LayerOptions,
  ): Rota<V | W> => {
    const next = layer(asDays(scope), value, options);
    const document = cascade<V | W>(...data.cascade.layers, next);
    return build({ type: "rota", cascade: document }, read);
  };

  return withMethods(data, {
    assign: append,
    swap: append,
    withRules: (rules: RuleRegistry) => build(data, { ...read, rules }),
    whoIsOn: (at: Temporal.ZonedDateTime) => valueAt(data.cascade, at, read),
    explain: (at: Temporal.ZonedDateTime) =>
      explainRota(data.cascade, at, read),
    shifts: (from: Temporal.ZonedDateTime, to?: Temporal.ZonedDateTime) =>
      resolve(
        data.cascade,
        to === undefined ? { ...read, from } : { ...read, from, to },
      ),
    validate: (from: Temporal.ZonedDateTime, to: Temporal.ZonedDateTime) =>
      validate(
        data.cascade,
        { ...read, from, to },
        { requireFullCoverage: true },
      ),
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
