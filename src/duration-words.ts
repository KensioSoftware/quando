/**
 * A length of time in words.
 *
 * `"PT4H"` in a sentence reads as machine output, and an explanation is meant
 * for a person. This is the one place that turns a duration into something to
 * put in one.
 */

const UNIT_WORDS = [
  ["years", "year"],
  ["months", "month"],
  ["weeks", "week"],
  ["days", "day"],
  ["hours", "hour"],
  ["minutes", "minute"],
  ["seconds", "second"],
  ["milliseconds", "millisecond"],
  ["microseconds", "microsecond"],
  ["nanoseconds", "nanosecond"],
] as const;

/**
 * A duration in words, because `"PT4H"` in a sentence reads as machine output.
 *
 * The two largest units that carry anything. Four hours stays four hours, and
 * four and a half becomes "4 hours 30 minutes" instead of a list running all
 * the way down to nanoseconds.
 */
export function spelled(duration: Temporal.Duration): string {
  return words(duration);
}

/**
 * The same, for a length nobody wrote down.
 *
 * A distance measured between two instants arrives in whatever units the
 * subtraction produced, so "787 hours" wants balancing into days first. A
 * length a rule holds is left exactly as the document has it: `"PT24H"` is
 * "24 hours" and never "1 day", because a rolling window and a calendar day
 * are the two things this rule type exists to keep apart.
 */
export function spelledDistance(duration: Temporal.Duration): string {
  return words(balance(duration));
}

function words(balanced: Temporal.Duration): string {
  const parts: string[] = [];
  for (const [field, word] of UNIT_WORDS) {
    const amount = Math.abs(balanced[field]);
    if (amount > 0 && parts.length < 2) {
      parts.push(`${amount} ${amount === 1 ? word : `${word}s`}`);
    }
  }
  return parts.length === 0 ? "no time" : parts.join(" ");
}

/**
 * The same length, written in the largest units it can be without a calendar.
 *
 * Two days reads better than forty-eight hours. A duration holding months,
 * years or weeks cannot be balanced without knowing which ones, and `round`
 * says so by throwing, which is the answer to hand it back as it came. The
 * same shape as `written` in [canonical-leaves.ts](./canonical-leaves.ts),
 * and for the same reason. This writes a sentence, and a sentence is worth
 * more total than exact.
 */
function balance(duration: Temporal.Duration): Temporal.Duration {
  try {
    return duration.round({ largestUnit: "day" });
  } catch {
    return duration;
  }
}
