/**
 * What a rule is evaluated against.
 *
 * An object rather than a bare window, because rules need more than a window
 * and always will: a sunrise rule needs coordinates, a rule written in the
 * Hebrew calendar needs the calendar, a rendered description needs the locale.
 * Adding a field here is harmless; changing a bare parameter into an object
 * later would break every rule implementation, including anyone else's.
 */

import type { RuleRegistry } from "./custom-rules.js";
import type { Occurrence } from "./occurrence.js";
export interface Context {
  /**
   * Where evaluation begins, and — since a `ZonedDateTime` carries one — the
   * time zone any rule that does not name its own is read in. One source of
   * truth: there is no way for a separate `zone` field to disagree with this.
   */
  readonly from: Temporal.ZonedDateTime;

  /**
   * Where evaluation stops. Optional, because a recurrence genuinely has no
   * end and pretending otherwise would have callers guessing a window big
   * enough to hold an answer they cannot predict.
   *
   * Leaving it out means the streams a rule produces may be endless. That is
   * supported and sometimes what you want — `take(…, 3)` over an endless
   * stream is exact and cheap — but a composition whose answer is empty then
   * has nothing to discover that from, and will not finish. Bound the window
   * when the answer might be empty.
   */
  readonly to?: Temporal.ZonedDateTime;

  /** How local times in clock changes are resolved. */
  readonly disambiguation?: "compatible" | "earlier" | "later" | "reject";

  /**
   * The custom rule types this evaluation can read, by name.
   *
   * A `custom` rule document names one of these. Evaluating a document that
   * names one absent from here throws {@link UnknownCustomRuleError}, which is
   * the honest answer to a rule whose meaning nobody in the room holds.
   */
  readonly rules?: RuleRegistry;

  /**
   * What has already happened, for the rules that count it.
   *
   * `atMost` and `spacedBy` read this. Absent and empty are different: `[]`
   * says nothing has happened yet, and leaving it out throws
   * {@link MissingOccurrencesError} rather than reporting a fifth dose as fine
   * because nobody mentioned the four already taken.
   *
   * A plain array, never an interval stream. Two occurrences at one instant
   * are two occurrences, and coalescing them would lose the count that is the
   * whole question.
   */
  readonly occurrences?: readonly Occurrence[];
}

/** The context's window, in the form the interval algebra takes. */
export function windowOf(context: Context): {
  readonly start: Temporal.ZonedDateTime;
  readonly end: Temporal.ZonedDateTime | undefined;
} {
  return { start: context.from, end: context.to };
}

/** The same instant window displayed in another time zone. */
export function contextInZone(context: Context, zone: string): Context {
  return {
    ...context,
    from: context.from.withTimeZone(zone),
    ...(context.to === undefined ? {} : { to: context.to.withTimeZone(zone) }),
  };
}

/** The zone a rule is read in when it does not name one of its own. */
export function zoneOf(context: Context, override?: string): string {
  return override ?? context.from.timeZoneId;
}

/**
 * The same window read on another calendar.
 *
 * The instants do not move. Only the year, month and day a rule sees when it
 * reads a date change, which is the whole of what a calendar decides.
 */
export function contextInCalendar(context: Context, calendar: string): Context {
  return {
    ...context,
    from: context.from.withCalendar(calendar),
    ...(context.to === undefined
      ? {}
      : { to: context.to.withCalendar(calendar) }),
  };
}

/**
 * The calendar a rule counts on.
 *
 * Read from `context.from` for the same reason the zone is. A `ZonedDateTime`
 * carries one, so there is no separate field that could disagree with it.
 */
export function calendarOf(context: Context): string {
  return context.from.calendarId;
}

/** Whether a calendar is the ISO one Quando's month vocabulary assumes. */
export function isIsoCalendar(calendar: string): boolean {
  return calendar === "iso8601";
}
