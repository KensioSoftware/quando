import { always } from "./build.js";
import { cascade, type Layer, layer, replace } from "./cascade.js";
import type { Context } from "./context.js";
import type { RuleRegistry } from "./custom-rules.js";
import { withMethods } from "./fluent.js";
import type { LayerOptions } from "./layer-options.js";
import { parseCascade } from "./parse-cascade.js";
import { asDays, type PlainRule } from "./plain-forms.js";
import { tallyQueries } from "./tally-query.js";
import type { Tally, TallyData } from "./tally-types.js";

export type { Tally, TallyData, TallyExplanation } from "./tally-types.js";

function amount(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError("A tally amount must be a finite number.");
  }
  return value;
}

function fixed(
  scope: PlainRule,
  value: number,
  options: LayerOptions | undefined,
): Layer<number> {
  const constant = layer(always(), amount(value));
  const replacement = cascade(constant);
  return replace(asDays(scope), replacement, options);
}

/**
 * `read` is what the tally carries that its document cannot: the registry a
 * `custom` rule in one of its scopes is looked up in. It travels with every
 * derived tally and stays out of `data`, which is what `toJSON` returns.
 */
function build(data: TallyData, read?: Omit<Context, "from" | "to">): Tally {
  const append = (next: Layer<number>): Tally =>
    build(
      {
        type: "tally",
        cascade: {
          type: "cascade",
          merge: "sum",
          layers: [...data.cascade.layers, next],
        },
      },
      read,
    );
  const queries = tallyQueries(data.cascade, read);

  return withMethods(data, {
    plus: (scope: PlainRule, value: number, options?: LayerOptions) =>
      append(layer(asDays(scope), amount(value), options)),
    exactly: (scope: PlainRule, value: number, options?: LayerOptions) =>
      append(fixed(scope, value, options)),
    withRules: (rules: RuleRegistry) => build(data, { ...read, rules }),
    ...queries,
    at: queries.countAt,
    toJSON: () => ({ ...data }),
  });
}

/** Creates an empty tally. */
export function tally(): Tally {
  return build({
    type: "tally",
    cascade: { type: "cascade", merge: "sum", layers: [] },
  });
}

/** Reads a stored tally and restores its methods. */
export function parseTally(value: unknown, path = "tally"): Tally {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${path}: expected a tally object.`);
  }
  const node = value as Record<string, unknown>;
  if (node["type"] !== "tally") {
    throw new TypeError(`${path}.type: expected "tally".`);
  }
  const unknown = Object.keys(node).find(
    (field) => !["type", "cascade"].includes(field),
  );
  if (unknown !== undefined) {
    throw new TypeError(`${path}.${unknown}: unknown tally field.`);
  }
  const document = parseCascade(
    node["cascade"],
    (item, itemPath) => {
      if (typeof item !== "number" || !Number.isFinite(item)) {
        throw new TypeError(`${itemPath}: expected a finite number.`);
      }
      return item;
    },
    `${path}.cascade`,
  );
  if (document.merge !== "sum") {
    throw new TypeError(`${path}.cascade.merge: a tally uses sum.`);
  }
  return build({ type: "tally", cascade: document });
}
