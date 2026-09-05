/**
 * What comes back when a rule has no form in the notation being written.
 *
 * Reading throws, because a malformed cron expression is a mistake and there
 * is nothing to hand back. Writing does not. Quando's algebra is larger than
 * either notation, so "this rule is not an RRULE" is an answer rather than a
 * fault, and a caller deciding what to do about it wants a value rather than
 * an exception to catch.
 */

/** A rule with no form in the notation, and what is in the way. */
export interface Unwritable {
  readonly ok: false;
  /** Reads after "no cron expression, because …". */
  readonly reason: string;
}

export function unwritable(reason: string): Unwritable {
  return { ok: false, reason };
}
