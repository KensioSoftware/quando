/**
 * The dates a `dates` rule names, read once and kept.
 *
 * Reading them is the expensive part. A date arrives as whatever string the
 * document holds, and `Temporal` accepts several forms for one day, so finding
 * the order and the runs of consecutive days means parsing every entry. A
 * schedule closed on twenty years of bank holidays carries hundreds of them,
 * and asking whether it is open now would otherwise pay for all of them.
 *
 * So the reading is cached against the array the rule holds, and the runs come
 * back sorted. A stored document hands over the same array on every query,
 * which is what makes the second query cheap. A caller who builds the rule
 * afresh each time gets a fresh entry and the same answer.
 *
 * The cache is weak, so it holds nothing alive. It also assumes the array is
 * not written to after a query, which is the assumption the whole library
 * makes about a rule document.
 */

/** A stretch of consecutive named dates, half-open like every interval. */
export interface DateRun {
  readonly from: Temporal.PlainDate;
  /** The day after the last one in the run. */
  readonly to: Temporal.PlainDate;
}

const cache = new WeakMap<readonly string[], readonly DateRun[]>();

/**
 * The runs of consecutive days an array of date strings names, in order.
 *
 * Sorted and de-duplicated, because the contract is about the output and
 * callers write dates in whatever order they think of them.
 */
export function dateRuns(dates: readonly string[]): readonly DateRun[] {
  const known = cache.get(dates);
  if (known !== undefined) {
    return known;
  }
  const runs = readRuns(dates);
  cache.set(dates, runs);
  return runs;
}

function readRuns(dates: readonly string[]): readonly DateRun[] {
  const days = [
    ...new Set(dates.map((date) => Temporal.PlainDate.from(date).toString())),
  ]
    .toSorted()
    .map((date) => Temporal.PlainDate.from(date));

  const runs: DateRun[] = [];
  let from: Temporal.PlainDate | undefined;
  let to: Temporal.PlainDate | undefined;

  for (const day of days) {
    if (to !== undefined && Temporal.PlainDate.compare(day, to) === 0) {
      // Consecutive with the run so far, so it extends rather than starts one.
      to = day.add({ days: 1 });
      continue;
    }
    if (from !== undefined && to !== undefined) {
      runs.push({ from, to });
    }
    from = day;
    to = day.add({ days: 1 });
  }
  if (from !== undefined && to !== undefined) {
    runs.push({ from, to });
  }
  return runs;
}

/**
 * The runs holding a date on or after `date`, in order.
 *
 * Runs are sorted and do not touch, so their ends ascend with their starts and
 * a bisection finds the place to start. This is what keeps a point query off
 * the length of the list: a schedule closed on a thousand holidays looks at
 * about ten of them to answer whether it is open now.
 */
export function* runsFrom(
  runs: readonly DateRun[],
  date: Temporal.PlainDate,
): Iterable<DateRun> {
  let low = 0;
  let high = runs.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    // `middle` is inside the array, so the run is there. Reading it as it may
    // not be costs nothing and keeps the search correct either way: a run that
    // could not be read is one to look before rather than after.
    const end = runs[middle]?.to;
    if (end !== undefined && Temporal.PlainDate.compare(end, date) <= 0) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  // The array running out is what ends the walk, so the read that finds it is
  // the loop's own condition rather than a length check beside one.
  for (
    let index = low, run = runs[index];
    run !== undefined;
    index++, run = runs[index]
  ) {
    yield run;
  }
}
