/**
 * Who is on, in the words people use for that.
 *
 * The same machinery as a [schedule](./schedule.ts) with the value left open:
 * a rota assigns a person, a tariff assigns a rate, a roster assigns how many
 * are working. A `Rota<V>` is a `Cascade<V>`, so the core reads it unchanged.
 *
 * The value type accumulates as layers are added, so a rota of two names
 * answers `"alice" | "bob" | undefined` rather than `string` — which is what
 * makes an exhaustive switch over who is on call actually exhaustive. Ask for
 * `rota<string>()` when the names are not known up front.
 */

import { type Cascade, type Layer, layer } from "./cascade.js";
import type { Context } from "./context.js";
import { asDays, type PlainRule } from "./plain-forms.js";
import { resolve } from "./resolve.js";
import { take } from "./stream.js";
import type { ValuedStream } from "./valued-stream.js";

/** Who or what holds when, and the questions worth asking about that. */
export interface Rota<V> extends Cascade<V> {
  /** These times belong to this one, unless something later says otherwise. */
  readonly assign: <const W>(scope: PlainRule, value: W) => Rota<V | W>;

  /**
   * A swap: this day goes to this one instead.
   *
   * The same thing as an `assign` naming a single day — it exists because
   * "Carol is swapping the eleventh" is what happened, and a rota reads better
   * when the exceptions say they are exceptions.
   */
  readonly swap: <const W>(day: PlainRule, value: W) => Rota<V | W>;

  /** Who is on at that moment, or `undefined` if nobody is. */
  readonly whoIsOn: (at: Temporal.ZonedDateTime) => V | undefined;

  /**
   * Each stretch between two moments, and who has it.
   *
   * Leave `to` out for an endless run of them, which is lazy and safe to stop
   * pulling from whenever you have enough.
   */
  readonly shifts: (
    from: Temporal.ZonedDateTime,
    to?: Temporal.ZonedDateTime,
  ) => ValuedStream<V>;
}

function build<V>(layers: readonly Layer<V>[]): Rota<V> {
  const self: Rota<V> = {
    type: "cascade",
    layers,

    assign: <W>(scope: PlainRule, value: W) =>
      build<V | W>([...layers, layer<V | W>(asDays(scope), value)]),

    swap: <W>(day: PlainRule, value: W) =>
      build<V | W>([...layers, layer<V | W>(asDays(day), value)]),

    whoIsOn: (at) => {
      // The smallest window there is, so this terminates whatever the layers
      // say — the same trick `activeAt` uses on a rule.
      const moment: Context = { from: at, to: at.add({ nanoseconds: 1 }) };
      const [now] = take(resolve(self, moment), 1);
      return now?.value;
    },

    shifts: (from, to) =>
      resolve(self, to === undefined ? { from } : { from, to }),
  };

  return self;
}

/**
 * An empty rota: nobody is on until something says they are.
 *
 * ```ts
 * const onCall = rota()
 *   .assign(weekdays(), "alice")
 *   .assign(weekends(), "bob")
 *   .swap("2026-03-11", "carol");
 * ```
 */
export function rota<V = never>(): Rota<V> {
  return build<V>([]);
}
