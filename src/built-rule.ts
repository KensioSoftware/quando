import { withMethods } from "./fluent.js";
import type { AllRule, AnyRule, Rule } from "./rule.js";

/** A rule, plus the methods for combining it with others. */
export type Built<R extends Rule> = R & {
  /** Both this and the others must hold. */
  readonly and: (...others: readonly Rule[]) => Built<AllRule>;
  /** This or any of the others. */
  readonly or: (...others: readonly Rule[]) => Built<AnyRule>;
  /** This rule without the times covered by any of the others. */
  readonly except: (...others: readonly Rule[]) => Built<AllRule>;
};

/** Attaches fluent combination methods to a rule document. */
export function build<R extends Rule>(node: R): Built<R> {
  const self: Built<R> = withMethods(node, {
    and: (...others: readonly Rule[]) =>
      build({ type: "all", rules: [self, ...others] }),
    or: (...others: readonly Rule[]) =>
      build({ type: "any", rules: [self, ...others] }),
    except: (...others: readonly Rule[]) =>
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
