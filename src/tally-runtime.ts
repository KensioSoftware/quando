import type { Layer } from "./cascade.js";
import type { EvaluationOptions } from "./context.js";
import { domainScope } from "./domain-zone.js";
import { withMethods } from "./fluent.js";
import { withEvaluationOptions } from "./evaluation-options.js";
import { asDays, type RuleInput } from "./plain-forms.js";
import type { RuleData } from "./rule.js";
import { contribution, fixedCount } from "./tally-layers.js";
import { tallyQueries } from "./tally-query.js";
import type { Tally, TallyData } from "./tally-types.js";

/** Restores tally methods and carries evaluation settings into derived tallies. */
export function restoreTally(data: TallyData, read?: EvaluationOptions): Tally {
  const append = (next: Layer<number>): Tally =>
    restoreTally(
      {
        ...data,
        cascade: {
          ...data.cascade,
          layers: [...data.cascade.layers, next],
        },
      },
      read,
    );
  const scoped = (input: RuleInput): RuleData =>
    domainScope(asDays(input), data.zone);

  const methods: Omit<Tally, keyof TallyData> = {
    plus: (scope, value, options) =>
      append(contribution(scoped(scope), value, options)),
    setCount: (scope, value, options) =>
      append(fixedCount(scoped(scope), value, options)),
    withCustomRules: (rules) => restoreTally(data, { ...read, rules }),
    ...tallyQueries(data.cascade, read),
    toJSON: () => ({ ...data }),
  };
  return withEvaluationOptions(withMethods(data, methods), read);
}
