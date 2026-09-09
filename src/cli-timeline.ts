/** The `quando timeline` command. */

import { isRuleDefinition, readDefinition } from "./cli-definition.js";
import type { OutputFormat } from "./cli-option-values.js";
import { jsonOutput } from "./cli-output.js";
import { successful, type CliResult } from "./cli-result.js";
import { windowOptions } from "./cli-window-options.js";
import { timeline, renderTimeline, type Timeline } from "./timeline.js";

const HELP = `Usage:
  quando timeline <file> --from <datetime> --to <datetime> [--format json|text]

Returns covered time from a stored schedule or rule. JSON is the default.`;

/** Returns covered time from a stored schedule or rule. */
export async function timelineCommand(
  arguments_: readonly string[],
): Promise<CliResult> {
  const parsed = windowOptions("timeline", arguments_);
  if (parsed.help) {
    return successful(HELP);
  }
  const { file, from, to, format } = parsed.options;
  const definition = await readDefinition(file);
  if (definition.type === "schedule") {
    const output = definition.timeline(from, to);
    return successful(formatOutput(output, format));
  }
  if (isRuleDefinition(definition)) {
    const output = timeline(definition, { from, to });
    return successful(formatOutput(output, format));
  }
  throw new TypeError(
    `timeline expected a schedule or rule document, found ${JSON.stringify(definition.type)}.`,
  );
}

function formatOutput(value: Timeline, format: OutputFormat): string {
  return format === "text" ? renderTimeline(value) : jsonOutput(value);
}
