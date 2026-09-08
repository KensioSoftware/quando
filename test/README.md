# Property tests

Run the algebra and canonicalisation properties with Node 26:

```bash
pnpm exec vitest run src/interval-laws.test.ts src/canonical-laws.test.ts
```

These tests also run through `pnpm test` and `pnpm check`. Each interval
property runs 500 cases. Canonicalisation runs 150 cases for each of three
windows covering the London clock changes and a leap-year month boundary.

The interval generator constructs sorted, disjoint spans directly from integer
nanosecond endpoints. It does not use the operations being tested to normalize
its inputs. The membership oracle checks every nanosecond in and immediately
outside the generated range. Complements also exercise unbounded ends.

The rule generator builds trees up to three compositions deep. Leaves include
constants, weekdays, days of the month and time windows. Compositions include
intersection, union, negation and a Tokyo zone override. Empty selections,
repeated values and overnight windows are allowed.

Fast-check chooses a seed for each run. On failure it reports the seed, replay
path and shrunk counterexample. To reproduce a failure, add the reported
`seed` and `path` to that test's `fc.assert` options, keeping its `numRuns`:

```ts
fc.assert(law, { numRuns: 500, seed: 123456, path: "0:1:2" });
```

Replace the example values with those from the failure, then run only that test
using Vitest's `-t` option. After fixing a bug, preserve the counterexample as a
regression test and remove the temporary replay options.

## The RFC 5545 conformance corpus

`src/rrule-conformance.test.ts` checks `parseRRule` against the worked
expansions RFC 5545 prints beside its own recurrence examples, in section
3.8.5.3. Every other date in this suite is one somebody here worked out, and
these are an authority Quando had no hand in writing.

The examples are quoted in the spec's own notation, so `"September 2,9,16"` and
`"January 1-31"` appear as the RFC writes them and a `listed` helper expands
them. Keeping the notation means a reader can hold the file beside the spec and
compare, and that a transcription error has one place to hide rather than one
per example.

Examples using `COUNT`, `BYSETPOS`, `BYWEEKNO`, `BYYEARDAY` or a frequency
faster than a day are in the corpus as refusals. Quando declines each with a
reason, and the tests pin that boundary the way the passing ones pin the
answers.

## Benchmarks

`bench/` holds a benchmark suite, run on demand with `pnpm bench`. It is a
baseline to compare a change against and nothing gates on it, because a shared
CI runner's timings describe the runner.

One performance claim is gated, and it is written as a ratio so that a slow
machine cannot break it. `src/date-runs.test.ts` asserts that a point query
against four thousand dates costs about what one against a hundred costs. That
holds only while a `dates` rule reads its dates once and bisects to the window,
and it fails if either goes. [The performance
guide](../docs/performance/README.md) gives the numbers behind it.
