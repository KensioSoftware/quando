# Quando documentation

The long form of the [README](../README.md). The README is the tour; these pages
are the same material with room to explain itself, one topic at a time.

They are also the source for [quandojs.dev](https://quandojs.dev), which copies
each `docs/<path>/README.md` here to a page there. **Edit them here.** A change
made on the site is a change that will be overwritten.

## Status

There is a package, and these pages document what is in it: the interval core,
the rule language and its builder, the JSON boundary, the four queries, and
cascades. Every example on them was run against the built package and its
output pasted in.

Merging values that add rather than displace is designed and not built, and so
are estimates, backward search over an unbounded past, and the command line.
Pages about them are deliberately absent until there is something to call: a
documented function that does not exist is worse than an undocumented one that
does.

## How these pages work

The site scaffold has a contract, and `pnpm docs:check` enforces it here so that
a break is found in review rather than at deploy time.

- **One page per directory.** `docs/<path>/README.md` becomes the page at
  `<path>` on the site. Directories nest, and a directory can be both a page and
  a parent.
- **This file is the exception.** The docs root README is an index for people
  browsing the repo on GitHub. The site has its own home page, so this one is
  not copied.
- **The H1 becomes the page title** and is lifted out of the body.
- **The description is derived** from the opening paragraph unless the page
  declares one in frontmatter. Frontmatter is regenerated from this repo on
  every scaffold run, so this repo is the source of truth.
- **Link between pages relatively** — `[concepts](../concepts/)` — so the same
  link resolves both on GitHub and on the site.
- **Every page ends with a `<!-- card -->` comment** holding the code snippet its
  social image shows. It renders nowhere, on GitHub or on the site, and the
  scaffold fails on a page without one. Six lines of about sixty characters is
  what the image holds.

The card looks like this:

````markdown
<!-- card
```ts
const hours = weekdays().and(timeOfDay("09:00", "17:00"));
```
-->
````

## The pages

- [Getting started](getting-started/): what you need, how to install it, and a
  first query. Start here.
- [Concepts](concepts/): what a rule is, and why it yields intervals rather than
  answering yes or no. Worth reading once; everything else follows from it.
- [Rules](rules/): every rule type there is, what each produces, and the two
  behaviours that surprise people.
- [Queries](queries/): `advanceBy`, `activeAt`, `elapsed` and `next`, and what
  each does about a search that could run forever.
- [Time zones](time-zones/): which zone a rule is read in, and wall clock
  against elapsed time across a clock change.
- [Serialisation](serialisation/): the JSON form, and why an unknown field is an
  error rather than something to ignore.
- [Cascades](cascades/): ordered layers carrying values, for the questions a
  boolean schedule cannot answer.
- [API](api/): everything the package exports.

## Planned

Written when there is something true to say:

- **Merging values** — overlap that adds rather than displaces.
- **Estimates** — ranges, distributions, and the questions they answer.
- **Custom rule types** — the escape hatch, and the registry parsing needs.
- **The command line** — every `quando` command.
