/** Output formatting for the command-line interface. */

import type { ValidationDiagnostic } from "./semantic-validation.js";

/** Formats structured output as indented JSON. */
export function jsonOutput(value: unknown): string {
  return JSON.stringify(value, undefined, 2);
}

/** Formats validation diagnostics for a person reading a terminal. */
export function validationText(
  diagnostics: readonly ValidationDiagnostic[],
): string {
  if (diagnostics.length === 0) {
    return "No problems found.";
  }
  return diagnostics.map((diagnostic) => diagnosticText(diagnostic)).join("\n");
}

function diagnosticText(diagnostic: ValidationDiagnostic): string {
  if (diagnostic.code !== "uncovered-time") {
    return `${diagnostic.code}: ${diagnostic.message}`;
  }
  const { start, end } = diagnostic.interval;
  return (
    `${diagnostic.code}: ${diagnostic.message} ` +
    `From ${start?.toString() ?? "the unbounded past"} ` +
    `to ${end?.toString() ?? "the unbounded future"}.`
  );
}
