/**
 * A readable way to write a rule, which is also the rule.
 *
 * `weekdays().and(timeOfDay("09:00", "17:00"))` reads better than the nested
 * object literal it stands for — and it *is* that object literal, with methods
 * hanging off it. `JSON.stringify` omits function-valued properties, so a built
 * rule serialises to exactly the document a hand-written one would, with no
 * `.build()` step and nothing to unwrap.
 *
 * That is the whole trick: there is no builder type to convert out of, because
 * a built rule already satisfies `Rule`.
 */

import type {
  AllRule,
  AlwaysRule,
  AnyRule,
  DatesRule,
  DaysOfWeekRule,
  NeverRule,
  NotRule,
  Rule,
  TimeOfDayRule,
  Weekday,
} from "./rule.js";

/** A rule, plus the methods for combining it with others. */
export type Built<R extends Rule> = R & {
  /** Both this and the others must hold. */
  readonly and: (...others: readonly Rule[]) => Built<AllRule>;
  /** This or any of the others. */
  readonly or: (...others: readonly Rule[]) => Built<AnyRule>;
  /**
   * This, minus the times the others cover.
   *
   * The common shape by far — opening hours except holidays, a schedule except
   * a shutdown — and worth its own method because writing it out is
   * `all(this, not(any(others)))`, which reads like nothing at all.
   */
  readonly except: (...others: readonly Rule[]) => Built<AllRule>;
};

function build<R extends Rule>(node: R): Built<R> {
  const self: Built<R> = {
    ...node,
    and: (...others) => build({ type: "all", rules: [self, ...others] }),
    or: (...others) => build({ type: "any", rules: [self, ...others] }),
    except: (...others) =>
      build({
        type: "all",
        rules: [
          self,
          { type: "not", rule: { type: "any", rules: [...others] } },
        ],
      }),
  };
  return self;
}

/** All of time. */
export function always(): Built<AlwaysRule> {
  return build({ type: "always" });
}

/** No time at all. */
export function never(): Built<NeverRule> {
  return build({ type: "never" });
}

/** Whole days, by day of the week. */
export function daysOfWeek(...days: readonly Weekday[]): Built<DaysOfWeekRule> {
  return build({ type: "daysOfWeek", days });
}

/** Monday to Friday. */
export function weekdays(): Built<DaysOfWeekRule> {
  return daysOfWeek("monday", "tuesday", "wednesday", "thursday", "friday");
}

/** Saturday and Sunday. */
export function weekends(): Built<DaysOfWeekRule> {
  return daysOfWeek("saturday", "sunday");
}

/**
 * A wall-clock window within each day. A `to` earlier than `from` wraps past
 * midnight, so `timeOfDay("22:00", "06:00")` is a night shift.
 */
export function timeOfDay(
  from: string,
  to: string,
  zone?: string,
): Built<TimeOfDayRule> {
  return build(
    zone === undefined
      ? { type: "timeOfDay", from, to }
      : { type: "timeOfDay", from, to, zone },
  );
}

/** Whole days, by date. */
export function dates(...days: readonly string[]): Built<DatesRule> {
  return build({ type: "dates", dates: days });
}

/** Every one of these must hold. With none, all of time. */
export function all(...rules: readonly Rule[]): Built<AllRule> {
  return build({ type: "all", rules });
}

/** Any one of these. With none, no time at all. */
export function any(...rules: readonly Rule[]): Built<AnyRule> {
  return build({ type: "any", rules });
}

/** The times a rule does not cover. */
export function not(rule: Rule): Built<NotRule> {
  return build({ type: "not", rule });
}

/** Whole days, by the zone a day is measured in. */
export function inZone<R extends DaysOfWeekRule | DatesRule | TimeOfDayRule>(
  rule: R,
  zone: string,
): Built<R> {
  return build({ ...rule, zone });
}
