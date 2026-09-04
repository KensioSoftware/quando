# Quando documentation

These guides explain how to model time with Quando and how to choose the
simplest API for a task.

## Start here

Read the pages in this order if Quando is new to you:

1. [Getting started](getting-started/) builds opening hours and runs the first
   queries.
2. [Concepts](concepts/) explains rules, contexts, intervals, and value layers.
3. [Schedules and rotas](schedules/) covers the main domain APIs.
4. [Rules](rules/) shows how to compose custom time definitions.
5. [Queries](queries/) explains each question you can ask of a rule or schedule.
6. [Validation](validation/) finds semantic problems in a finite window.
7. [Explanations](explanations/) shows why rules applied and how layers produced
   a value.
8. [Timelines](timelines/) draws covered time for people to inspect.
9. [Command line](cli/) runs timelines, explanations, and validation from
   stored definitions.

## Guides by task

### Common APIs

- [Schedules and rotas](schedules/) covers opening hours and assignments.
- [Merging](merging/) introduces tallies and the numeric merge strategies.
- [Accumulation](accumulation/) totals numeric values over time.
- [Time zones](time-zones/) covers local time and daylight-saving changes.
- [Serialisation](serialisation/) covers storage, parsing, and validation.
- [Validation](validation/) finds inactive layers, shadowed layers, and gaps.
- [Explanations](explanations/) gives readable reasons for resolved values.
- [Timelines](timelines/) returns JSON data or a text chart of covered time.
- [Command line](cli/) reads stored definitions from a terminal.

### Custom models

- [Rules](rules/) defines recurring days, times, dates, and combinations.
- [Cron expressions](cron/) imports a cron expression as a rule.
- [Cascades](cascades/) assigns values with ordered overrides.
- [Merging](merging/) combines overlapping values with `sum`, `max`, `min`, or
  `concat`.
- [Accumulation](accumulation/) calculates totals such as staff-hours and cost.
- [Comparing](comparing/) canonicalises definitions for equality and cache keys.

### Reference

- [API](api/) lists the public exports from each package entry point.
- [Concepts](concepts/#limits) describes the current boundaries of the model.

## Editing these pages

The website at [quandojs.dev](https://quandojs.dev) is built from this
directory. Edit these files and let the site build copy them.

Each website page lives at `docs/<path>/README.md` and must contain one H1 plus
a trailing `<!-- card -->` block. The site uses the H1 as its title and the
first paragraph as its default description. Use relative links between pages.

Run the documentation check after editing:

```bash
pnpm docs:check
```

The repository index in this file is not copied to the website.
