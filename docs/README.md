# Quando documentation

The long form of the [README](../README.md). The README is the tour; these pages
are the same material with room to explain itself, one topic at a time.

They are also the source for [quandojs.dev](https://quandojs.dev), which copies
each `docs/<path>/README.md` here to a page there. **Edit them here.** A change
made on the site is a change that will be overwritten.

## Status

Quando is in design. Nothing is published, and the only pages that exist yet are
the ones describing the model, which is settled. Pages documenting an API are
deliberately absent until there is an API: a documented function that does not
exist is worse than an undocumented one that does.

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
const hours = weekdays().and(at("09:00", "17:00"));
```
-->
````

## Concepts

- [Concepts](concepts/): what a rule is, why it yields intervals rather than
  answering yes or no, and how rules layer.

## Planned

Written when there is something true to say:

- **Getting started** — install, first query. Needs a published package.
- **Rules** — every built-in rule type.
- **Cascades** — layering, precedence, overrides.
- **Durations** — elapsed time that only counts during certain periods.
- **Estimates** — ranges, distributions, and the questions they answer.
- **Time zones and DST** — wall clock against exact time.
- **Serialisation** — the JSON form, and custom rule types.
- **The command line** — every `quando` command.
- **API** — everything the package exports.
