/** The `quando validate` command. */

import {
  isRuleDefinition,
  readDefinition,
  type CliDefinition,
} from "./cli-definition.js";
import { jsonOutput, validationText } from "./cli-output.js";
import type { CliResult } from "./cli-result.js";
import { windowOptions } from "./cli-window-options.js";
import { validate, type ValidationDiagnostic } from "./semantic-validation.js";

const HELP = `Usage:
  quando validate <file> --from <datetime> --to <datetime> [--format json|text]

Finds problems in a finite window. A result containing diagnostics exits with status 1.`;

/** Finds semantic problems in a stored definition. */
export async function validateCommand(
  arguments_: readonly string[],
): Promise<CliResult> {
  const parsed = windowOptions("validate", arguments_);
  if (parsed.help) {
    return { output: HELP, exitCode: 0 };
  }
  const { file, from, to, format } = parsed.options;
  const definition = await readDefinition(file);
  const diagnostics = validationOf(definition, from, to);
  return {
    output:
      format === "text" ? validationText(diagnostics) : jsonOutput(diagnostics),
    exitCode: diagnostics.length === 0 ? 0 : 1,
  };
}

function validationOf(
  definition: CliDefinition,
  from: Temporal.ZonedDateTime,
  to: Temporal.ZonedDateTime,
): readonly ValidationDiagnostic[] {
  return isRuleDefinition(definition)
    ? validate(definition, { from, to })
    : definition.validate(from, to);
}
