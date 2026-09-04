/**
 * The five cron fields, and what each one accepts.
 *
 * One table per field, holding its range and the names cron allows in it.
 * [cron-fields.ts](./cron-fields.ts) has the grammar that reads a field
 * against one of these.
 */

/** What a field may hold, and what to call it when it holds something else. */
export interface CronField {
  readonly name: string;
  readonly min: number;
  readonly max: number;
  /** Lowercase names the field accepts, in value order from `min`. */
  readonly names?: readonly string[];
}

/**
 * The numbers a field selects, sorted, and whether it was left unrestricted.
 *
 * Cron treats an unrestricted day field differently from one that happens to
 * name every day, so `restricted` is carried rather than inferred from the
 * set's size.
 */
export interface CronSelection {
  readonly values: readonly number[];
  readonly restricted: boolean;
}

const MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const MINUTE_FIELD: CronField = { name: "minute", min: 0, max: 59 };

export const HOUR_FIELD: CronField = { name: "hour", min: 0, max: 23 };

export const DAY_OF_MONTH_FIELD: CronField = {
  name: "day of month",
  min: 1,
  max: 31,
};

export const MONTH_FIELD: CronField = {
  name: "month",
  min: 1,
  max: 12,
  names: MONTH_NAMES,
};

// Cron writes Sunday as both 0 and 7. The extra value is folded away in
// `cron.ts`, so the range here is the one the grammar accepts.
export const DAY_OF_WEEK_FIELD: CronField = {
  name: "day of week",
  min: 0,
  max: 7,
  names: DAY_NAMES,
};
