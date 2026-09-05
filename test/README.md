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
