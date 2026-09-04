/** The read-only commands exposed by the `quando` executable. */

import { readVersion } from "./cli-definition.js";
import { explainCommand } from "./cli-explain.js";
import { successful, type CliResult } from "./cli-result.js";
import { timelineCommand } from "./cli-timeline.js";
import { validateCommand } from "./cli-validate.js";

const ROOT_HELP = `Quando answers questions about stored time definitions.

Usage:
  quando timeline <file> --from <datetime> --to <datetime> [--format json|text]
  quando explain <file> --at <datetime> [--format json|text]
  quando validate <file> --from <datetime> --to <datetime> [--format json|text]

Commands:
  timeline  Show the time covered by a schedule or rule
  explain   Explain a schedule, rota, tally, or rule at one instant
  validate  Find problems in a schedule, rota, tally, or rule

Options:
  -h, --help  Show help
  --version   Show the installed version`;

/** Runs one command without writing to process streams. */
export async function runCli(
  arguments_: readonly string[],
): Promise<CliResult> {
  const [command, ...rest] = arguments_;
  switch (command) {
    case "--help":
    case "-h":
    case "help": {
      return successful(ROOT_HELP);
    }
    case "--version": {
      return successful(await readVersion());
    }
    case "timeline": {
      return timelineCommand(rest);
    }
    case "explain": {
      return explainCommand(rest);
    }
    case "validate": {
      return validateCommand(rest);
    }
    case undefined: {
      throw new TypeError(
        'A command is required. Run "quando --help" for usage.',
      );
    }
    default: {
      throw new TypeError(
        `Unknown command ${JSON.stringify(command)}. Run "quando --help" for usage.`,
      );
    }
  }
}
