/** Validation for individual command-line argument values. */

export type OutputFormat = "json" | "text";

/** Reads the one stored definition accepted by a command. */
export function fileOption(
  command: string,
  positionals: readonly string[],
): string {
  const [file] = positionals;
  if (file === undefined) {
    throw new TypeError(`${command} requires the path to a JSON file.`);
  }
  if (positionals.length > 1) {
    throw new TypeError(`${command} accepts one JSON file.`);
  }
  return file;
}

/** Reads a required zoned date-time option. */
export function dateTimeOption(
  command: string,
  name: string,
  value: string | undefined,
): Temporal.ZonedDateTime {
  if (value === undefined) {
    throw new TypeError(`${command} requires --${name}.`);
  }
  try {
    return Temporal.ZonedDateTime.from(value);
  } catch {
    throw new TypeError(
      `${command} expected --${name} to be a zoned date-time, found ${JSON.stringify(value)}.`,
    );
  }
}

/** Reads the JSON or text output format. */
export function formatOption(value: string | undefined): OutputFormat {
  if (value === undefined || value === "json") {
    return "json";
  }
  if (value === "text") {
    return value;
  }
  throw new TypeError(
    `Expected --format to be json or text, found ${JSON.stringify(value)}.`,
  );
}
