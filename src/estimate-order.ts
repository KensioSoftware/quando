/**
 * Putting outcomes in order, which is what a median and a CDF need.
 *
 * An estimate holds outcomes of whatever type the query answers with, and the
 * useful ones here are counts, durations and datetimes. {@link naturally}
 * knows those and the rest of what `Temporal` returns. Anything else needs an
 * {@link Order} of its own, and every view takes one.
 */

/** How two outcomes compare. Negative, zero or positive, like every other. */
export type Order<V> = (left: V, right: V) => number;

/**
 * The order a number, a duration or an instant already has.
 *
 * Throws where the outcomes are of some other type, naming the option that
 * takes an order for them.
 */
export function naturally<V>(left: V, right: V): number {
  if (left instanceof Temporal.Duration && right instanceof Temporal.Duration) {
    return Temporal.Duration.compare(left, right);
  }

  const first = sortKey(left);
  const second = sortKey(right);
  if (first === undefined || second === undefined) {
    throw new RangeError(
      `No natural order for ${describe(left)}. Pass an \`order\` that ` +
        "compares two of them.",
    );
  }
  if (first < second) {
    return -1;
  }
  if (first > second) {
    return 1;
  }
  return 0;
}

/** Something orderable that stands for the value, where one exists. */
function sortKey(value: unknown): bigint | number | string | undefined {
  if (
    typeof value === "bigint" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (value instanceof Temporal.ZonedDateTime) {
    return value.epochNanoseconds;
  }
  if (value instanceof Temporal.Instant) {
    return value.epochNanoseconds;
  }
  if (
    value instanceof Temporal.PlainDate ||
    value instanceof Temporal.PlainDateTime ||
    value instanceof Temporal.PlainTime ||
    value instanceof Temporal.PlainYearMonth
  ) {
    return value.toString();
  }
  return undefined;
}

/** What to call a value in the message that refuses to order it. */
function describe(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }
  const named: unknown = value.constructor;
  if (typeof named === "function" && named.name !== "") {
    return named.name;
  }
  return typeof value;
}
