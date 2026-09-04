/** The `quando explain` command. */

import { isRuleDefinition, readDefinition } from "./cli-definition.js";
import { jsonOutput } from "./cli-output.js";
import { pointOptions } from "./cli-point-options.js";
import { successful, type CliResult } from "./cli-result.js";
import { explainRule } from "./explain.js";

const HELP = `Usage:
  quando explain <file> --at <datetime> [--format json|text]

Explains the result at one instant. JSON is the default. Text returns the summary.`;

/** Explains one instant from a stored definition. */
export async function explainCommand(
  arguments_: readonly string[],
): Promise<CliResult> {
  const parsed = pointOptions("explain", arguments_);
  if (parsed.help) {
    return successful(HELP);
  }
  const { file, at, format } = parsed.options;
  const definition = await readDefinition(file);
  if (isRuleDefinition(definition)) {
    const explanation = explainRule(definition, at);
    return successful(
      format === "text" ? explanation.description : jsonOutput(explanation),
    );
  }
  const explanation = definition.explain(at);
  return successful(
    format === "text" ? explanation.summary : jsonOutput(explanation),
  );
}
