import { fail } from "./parse-shape.js";

/** Reads an inclusive date-only bound and rejects unsupported timestamps. */
export function parseUntil(value: string): string {
  const match = /^(?<date>\d{8})(T(?<time>\d{6})(?<utc>Z)?)?$/u.exec(
    value.trim(),
  );
  const date = match?.groups?.["date"];
  if (date === undefined) {
    return fail(
      "UNTIL",
      `"${value}" is not a date. Expected something like 20261231T235959Z`,
    );
  }

  const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  const time = match?.groups?.["time"];
  if (time !== undefined) {
    return fail(
      "UNTIL",
      "timestamp bounds are not supported. Use a date-only UNTIL or retain the recurrence in a calendar library that preserves occurrence timestamps",
    );
  }
  return checkedDate(iso, value);
}

function checkedDate(iso: string, written: string): string {
  try {
    Temporal.PlainDate.from(iso);
  } catch {
    return fail("UNTIL", `"${written}" is not a date`);
  }
  return iso;
}
