/** The output and process status from one CLI command. */
export interface CliResult {
  readonly output: string;
  readonly exitCode: 0 | 1;
}

/** A successful command result. */
export function successful(output: string): CliResult {
  return { output, exitCode: 0 };
}
