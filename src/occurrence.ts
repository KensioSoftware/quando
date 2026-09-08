/**
 * Something that happened, which a constraint counts.
 *
 * Everything else in Quando asks whether an instant is permitted. A constraint
 * asks how many times something has already happened, and that needs an input
 * nothing else takes. A record of what has.
 *
 * **Occurrences are a multiset, and deliberately not an interval set.** Two
 * doses at the same minute are two doses, and `IntervalStream` would coalesce
 * them into one. So a history is a plain array, it never goes near the stream
 * algebra, and nothing sorts or merges it on the way in.
 */

/** One thing that happened. Leave `lasting` off for a moment. */
export interface Occurrence {
  readonly at: Temporal.ZonedDateTime;
  /** How long it went on. A dose takes no time; a trip takes days. */
  readonly lasting?: Temporal.Duration;
}

/** The instant an occurrence finished, which is when it started if it was a moment. */
export function endOf(occurrence: Occurrence): Temporal.ZonedDateTime {
  return occurrence.lasting === undefined
    ? occurrence.at
    : occurrence.at.add(occurrence.lasting);
}

/**
 * A constraint was asked about with no history at all.
 *
 * Absent and empty mean different things here, and telling them apart is the
 * point. `occurrences: []` says nothing has happened yet, which is a real
 * state and the most permissive answer is the right one. Leaving the field out
 * says the caller forgot, and answering that permissively would report a
 * fifth dose as fine because nobody mentioned the four already taken.
 */
export class MissingOccurrencesError extends Error {
  public constructor(ruleType: string) {
    super(
      `The "${ruleType}" rule counts what has already happened, and the ` +
        "context carries no `occurrences`. Pass the history as " +
        "`occurrences` on the context, or `occurrences: []` if nothing has " +
        "happened yet.",
    );
    this.name = "MissingOccurrencesError";
  }
}

/** The history a constraint reads, or an error saying it was left out. */
export function historyOf(
  occurrences: readonly Occurrence[] | undefined,
  ruleType: string,
): readonly Occurrence[] {
  if (occurrences === undefined) {
    throw new MissingOccurrencesError(ruleType);
  }
  return occurrences;
}
