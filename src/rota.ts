import { rotaQueries } from "./rota-query.js";
import { parseDomain } from "./parse-domain.js";
import { cascade, layer } from "./cascade.js";
import type { Context } from "./context.js";
import { domainScope, domainZone } from "./domain-zone.js";
import type { RuleRegistry } from "./custom-rules.js";
import { withMethods } from "./fluent.js";
import { withEvaluationOptions } from "./evaluation-options.js";
import type { JsonCompatible } from "./json.js";
import type { LayerOptions } from "./layer-options.js";
import type { ValueParser } from "./parse-cascade.js";
import { asDays, type RuleInput } from "./plain-forms.js";
import type { Rota, RotaData, RotaOptions } from "./rota-types.js";

export type { Rota, RotaData, RotaOptions } from "./rota-types.js";

function build<V, Allowed = V>(
  data: RotaData<V>,
  read?: Omit<Context, "from" | "to">,
): Rota<V, Allowed> {
  const append = <const W extends Allowed>(
    scope: RuleInput,
    value: W & JsonCompatible<W>,
    options?: LayerOptions,
  ): Rota<V | W, Allowed> => {
    const rule = asDays(scope);
    const next = layer<W>(domainScope(rule, data.zone), value, options);
    const document = cascade<V | W>(...data.cascade.layers, next);
    return build<V | W, Allowed>({ ...data, cascade: document }, read);
  };

  const methods: Omit<Rota<V, Allowed>, keyof RotaData<V>> = {
    assign: append as Rota<V, Allowed>["assign"],
    withCustomRules: (rules: RuleRegistry) =>
      build<V, Allowed>(data, { ...read, rules }),
    ...rotaQueries(data.cascade, read),
    toJSON: () => ({ ...data }),
  };
  return withEvaluationOptions(withMethods(data, methods), read);
}

/** Creates an empty rota. */
export function rota(options?: RotaOptions): Rota<never, unknown>;
export function rota<V>(options?: RotaOptions): Rota<V>;
export function rota(options: RotaOptions = {}): Rota<never, unknown> {
  return build<never, unknown>({
    type: "rota",
    cascade: cascade<never>(),
    ...domainZone(options),
  });
}

/** Reads a stored rota and restores its methods. */
export function parseRota<V>(
  value: unknown,
  parseValue: ValueParser<V>,
  path = "rota",
): Rota<V> {
  return build({
    type: "rota",
    ...parseDomain(value, "rota", parseValue, path),
  });
}
