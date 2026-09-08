/**
 * Reducing an `all` or an `any` to the one form that says what it says.
 *
 * The two are the same shape with the constants swapped, so they are written
 * once here. [canonical-rule.ts](./canonical-rule.ts) owns the walk over the
 * rest of the language and hands the compounds to this.
 */

import { byCodeUnit } from "./code-unit-order.js";
import type { Rule } from "./rule.js";

/** A rule's stable string form, which is what sorting and equality compare. */
function key(rule: Rule): string {
  return JSON.stringify(rule);
}

/**
 * The operands of an `all` or an `any`, flattened, reduced and ordered.
 *
 * Both are the same shape with the two constants swapped. For `all`, `always`
 * adds nothing and `never` settles it. For `any` it is the other way round.
 */
export function combined(
  type: "all" | "any",
  rules: readonly Rule[],
  canonical: (rule: Rule) => Rule,
): Rule {
  const absorbed = type === "all" ? "always" : "never";
  const settles = type === "all" ? "never" : "always";

  const flat: Rule[] = [];
  for (const rule of rules) {
    const inner = canonical(rule);

    if (inner.type === settles) {
      return { type: settles };
    }
    if (inner.type === absorbed) {
      continue;
    }
    // Already canonical, so its own operands are reduced and its type is not
    // the one being flattened into unless it genuinely nests.
    if (inner.type === type) {
      flat.push(...inner.rules);
      continue;
    }
    flat.push(inner);
  }

  const kept = [...new Map(flat.map((rule) => [key(rule), rule])).values()];
  const unique = kept.toSorted((a, b) => byCodeUnit(key(a), key(b)));
  const only = unique[0];

  if (only === undefined) {
    return { type: absorbed };
  }
  return unique.length === 1 ? only : { type, rules: unique };
}
