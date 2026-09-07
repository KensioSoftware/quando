/**
 * Parsing the rule type Quando did not write.
 *
 * Whether a rule type of this name exists is a question for the registry a
 * query carries, and it is asked at evaluation. A document naming a rule this
 * process has never heard of still parses, which is what lets a service store
 * and forward a schedule it cannot itself evaluate.
 *
 * The options are checked against what JSON can hold, because they are stored
 * with the rule. What they *mean* belongs to whoever implements the type.
 */

import { assertJsonValue } from "./json.js";
import { zonePart } from "./parse-fields.js";
import { fail, shapeOf } from "./parse-shape.js";
import type { CustomRule } from "./rule.js";

export function parseCustomRule(
  node: Record<string, unknown>,
  path: string,
): CustomRule {
  const name = node["name"];
  if (typeof name !== "string" || name.length === 0) {
    return fail(
      `${path}.name`,
      `expected the name of a custom rule type, found ${shapeOf(name)}`,
    );
  }

  const options = node["options"];
  if (options !== undefined) {
    assertJsonValue(options, `${path}.options`);
  }

  return {
    type: "custom",
    name,
    ...(options === undefined ? {} : { options }),
    ...zonePart(node, path),
  };
}
