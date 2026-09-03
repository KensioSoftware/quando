import type { ExplanationDomain } from "./explanation-text.js";

/** Writes the resolved value in the vocabulary of its public API. */
export function resultDescription(
  value: unknown,
  at: Temporal.ZonedDateTime,
  domain: ExplanationDomain,
): string {
  const moment = formatMoment(at);
  if (domain === "schedule") {
    return `The schedule is ${value === true ? "open" : "closed"} on ${moment}.`;
  }
  if (domain === "rota") {
    return value === undefined
      ? `Nobody is assigned on ${moment}.`
      : `The rota assigns ${formatValue(value)} on ${moment}.`;
  }
  if (domain === "tally") {
    return `The total is ${formatValue(value === undefined ? 0 : value)} on ${moment}.`;
  }
  return value === undefined
    ? `The cascade assigns no value on ${moment}.`
    : `The cascade resolves to ${formatValue(value)} on ${moment}.`;
}

/** Writes a JSON-compatible value in an explanation sentence. */
export function formatValue(value: unknown): string {
  return JSON.stringify(value);
}

function formatMoment(at: Temporal.ZonedDateTime): string {
  const time = at.toPlainTime();
  const clock =
    time.second === 0 &&
    time.millisecond === 0 &&
    time.microsecond === 0 &&
    time.nanosecond === 0
      ? `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`
      : time.toString();
  return `${at.toPlainDate().toString()} at ${clock} in ${at.timeZoneId}`;
}
