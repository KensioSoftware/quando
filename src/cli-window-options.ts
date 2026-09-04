/** Arguments accepted by commands that use a finite window. */

import { parseArgs } from "node:util";

import {
  dateTimeOption,
  fileOption,
  formatOption,
  type OutputFormat,
} from "./cli-option-values.js";

interface WindowOptions {
  readonly file: string;
  readonly from: Temporal.ZonedDateTime;
  readonly to: Temporal.ZonedDateTime;
  readonly format: OutputFormat;
}

export type ParsedWindowOptions =
  | { readonly help: true }
  | { readonly help: false; readonly options: WindowOptions };

/** Parses the finite window used by `timeline` and `validate`. */
export function windowOptions(
  command: string,
  arguments_: readonly string[],
): ParsedWindowOptions {
  const { values, positionals } = parseArgs({
    args: [...arguments_],
    allowPositionals: true,
    options: {
      from: { type: "string" },
      to: { type: "string" },
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
      from: dateTimeOption(command, "from", values.from),
      to: dateTimeOption(command, "to", values.to),
      format: formatOption(values.format),
    },
  };
}
