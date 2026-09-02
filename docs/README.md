# Quando documentation

These pages explain how to use Quando. Start with
[getting started](getting-started/), then use the other pages as guides and
reference material.

The website at [quandojs.dev](https://quandojs.dev) is built from these files.
Edit the files in this directory. The website build overwrites direct changes
to the site.

## Status

These pages document the current package. They cover rules, intervals, queries,
serialisation, cascades, schedules, rotas, merging, and comparison. The example
output comes from the built package.

Quando does not yet include estimates, backward search over an unbounded past,
or a command-line interface. The documentation covers implemented features
only.

## How these pages work

Run `pnpm docs:check` after editing these files. It checks the structure expected
by the website.

- Put each page in `docs/<path>/README.md`. It becomes the website page at
  `<path>`.
- Keep this file as the repository index. The website has a separate home page.
- Start every page with one H1. The website uses it as the page title.
- Start each page with a useful summary paragraph. The website uses it as the
  default page description.
- Use relative links between documentation pages, such as
  `[concepts](../concepts/)`.
- End every website page with a `<!-- card -->` comment. The comment contains
  the code shown on its social image. Aim for six lines of about 60 characters.

The card looks like this:

<!-- prose-check:off -->

````markdown
<!-- card
```ts
const hours = weekdays().and(timeOfDay("09:00", "17:00"));
```
-->
````

<!-- prose-check:on -->

## The pages

- [Getting started](getting-started/) covers requirements, installation, and
  the first queries.
- [Concepts](concepts/) explains rules, intervals, and cascades.
- [Rules](rules/) documents every rule type and the rule builder.
- [Queries](queries/) documents `advanceBy`, `activeAt`, `elapsed`, and `next`.
- [Time zones](time-zones/) explains how Quando handles local time and clock
  changes.
- [Serialisation](serialisation/) explains the JSON format and parsing.
- [Schedules and rotas](schedules/) provides simpler APIs for opening hours and
  assignments.
- [Cascades](cascades/) explains ordered layers that assign values over time.
- [Merging](merging/) explains how overlapping values can be combined.
- [Comparing](comparing/) covers canonical form, equality, and fingerprints.
- [API](api/) lists every package export.

## Planned

The following features are planned:

- Estimates and uncertainty.
- Custom rule types.
- Rule set diffing.
- A command-line interface.

Two planned features would change the existing API and therefore require a
later major version:

- Constraints on a set of occurrences, such as caps per window, minimum
  spacing, and rolling-window totals. See
  [what a rule cannot say](concepts/#what-a-rule-cannot-say).
- Validity horizons, which would let a query return an unknown result beyond
  the date covered by its data.
