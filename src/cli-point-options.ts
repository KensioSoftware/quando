/** Arguments accepted by the `explain` command. */

import { parseArgs } from "node:util";

import {
  dateTimeOption,
  fileOption,
  formatOption,
  type OutputFormat,
} from "./cli-option-values.js";

interface PointOptions {
  readonly file: string;
  readonly at: Temporal.ZonedDateTime;
  readonly format: OutputFormat;
}

export type ParsedPointOptions =
  | { readonly help: true }
  | { readonly help: false; readonly options: PointOptions };

/** Parses the options used by `explain`. */
export function pointOptions(
  command: string,
  arguments_: readonly string[],
): ParsedPointOptions {
  const { values, positionals } = parseArgs({
    args: [...arguments_],
    allowPositionals: true,
    options: {
      at: { type: "string" },
      format: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help === true) {
    return { help: true };
  }
  return {
    help: false,
    options: {
      file: fileOption(command, positionals),
      at: dateTimeOption(command, "at", values.at),
      format: formatOption(values.format),
    },
  };
}
