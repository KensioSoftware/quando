import { withMethods } from "./fluent.js";
import type { AllRule, AnyRule, RuleData } from "./rule.js";

/** A rule, plus the methods for combining it with others. */
export type Rule<R extends RuleData = RuleData> = R & {
  /** Both this and the others must hold. */
  readonly and: (...others: readonly RuleData[]) => Rule<AllRule>;
  /** This or any of the others. */
  readonly or: (...others: readonly RuleData[]) => Rule<AnyRule>;
  /** This rule without the times covered by any of the others. */
  readonly except: (...others: readonly RuleData[]) => Rule<AllRule>;
};

/** Attaches fluent combination methods to a rule document. */
export function build<R extends RuleData>(node: R): Rule<R> {
  const self: Rule<R> = withMethods(node, {
    and: (...others: readonly RuleData[]) =>
      build({ type: "all", rules: [self, ...others] }),
    or: (...others: readonly RuleData[]) =>
      build({ type: "any", rules: [self, ...others] }),
    except: (...others: readonly RuleData[]) =>
      build({
        type: "all",
        rules: [
          self,
          { type: "not", rule: { type: "any", rules: [...others] } },
        ],
      }),
  });
  return self;
}
