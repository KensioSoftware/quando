/** Rejects calendar units where a query needs exact elapsed time. */
export function checkExactDuration(amount: Temporal.Duration): void {
  const calendar = (["years", "months", "weeks", "days"] as const).filter(
    (unit) => amount[unit] !== 0,
  );

  if (calendar.length > 0) {
    throw new RangeError(
      `advanceBy() measures elapsed time, so ${amount.toString()} is ambiguous: ` +
        `${calendar.join(" and ")} are calendar units, and a day is not 24 hours ` +
        "on the mornings a clock changes. Give hours, minutes or seconds.",
    );
  }
}
