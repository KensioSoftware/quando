/**
 * Describing a match on a rule Quando did not write.
 *
 * A rule type can supply its own sentence, because only it knows what its
 * options mean. Without one there is still something honest to say, and it is
 * better than a blank where every other rule gives a reason.
 *
 * The registry may be absent here even though evaluation needed it, since an
 * explanation is also produced for rules that did not match and for documents
 * read without one. The description says what it can either way.
 */

import type { RuleRegistry } from "./custom-rules.js";
import type { CustomRule } from "./rule.js";

export function describeCustomMatch(
  rule: CustomRule,
  matched: boolean,
  registry: RuleRegistry | undefined,
): string {
  const own = registry?.[rule.name]?.describe?.(rule.options);
  const outcome = matched ? "matches" : "does not match";

  return own === undefined
    ? `The custom rule "${rule.name}" ${outcome} at this instant.`
    : `${own} It ${outcome} at this instant.`;
}
