import type { CoveredDayOptions } from "./covered-days.js";
import { coveredDays } from "./day-walk.js";
import { boundSearch, SearchLimitExceededError } from "./search.js";
import { refuse, unknownIn, upTo } from "./horizon-guard.js";

/** Finds the arrival after counting covered calendar dates. */
export function dayArrival<V>(
  from: Temporal.ZonedDateTime,
  count: number,
  options: CoveredDayOptions<V>,
): Temporal.ZonedDateTime | undefined {
  checkDayCount(count);
  if (count === 0) {
    return from;
  }

  const { during, startingDay = "excluded", ...rest } = options;
  const search = boundSearch({ ...rest, from }, options);
  const startDate = from.toPlainDate();
  const relevant = {
    ...search.context,
    from:
      startingDay === "excluded" ? from.add({ days: 1 }).startOfDay() : from,
  };

  let counted = 0;
  for (const day of coveredDays(during, search.context)) {
    if (startingDay === "excluded" && day.date.equals(startDate)) {
      continue;
    }
    counted += 1;
    if (counted === count) {
      const fog = unknownIn(
        during,
        upTo(relevant, day.opensAt.add({ nanoseconds: 1 })),
      );
      if (fog !== undefined) {
        refuse("addCoveredDays()", fog, relevant);
      }
      return day.opensAt;
    }
  }

  const fog =
    Temporal.ZonedDateTime.compare(relevant.from, relevant.to) < 0
      ? unknownIn(during, relevant)
      : undefined;
  if (fog !== undefined) {
    refuse("addCoveredDays()", fog, relevant);
  }
  if (search.automaticLimit !== undefined) {
    throw new SearchLimitExceededError(
      "addCoveredDays()",
      search.automaticLimit,
    );
  }
  return undefined;
}

/** Rejects a count that is not a whole number of days forward. */
function checkDayCount(count: number): void {
  if (!Number.isInteger(count)) {
    throw new RangeError(
      `addCoveredDays() counts whole days. Asked for ${count}. ` +
        "Part of a covered day is an elapsed duration, which addCoveredTime() takes.",
    );
  }
  if (count < 0) {
    throw new RangeError(
      `addCoveredDays() cannot go backwards. Asked for ${count} days.`,
    );
  }
}
