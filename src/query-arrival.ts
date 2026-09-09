import type { Distribution, Possibilities } from "./estimate.js";

/** The arrival shape follows the supplied scalar or estimate. */
export type QueryArrival<A> =
  A extends Possibilities<unknown>
    ? Possibilities<Temporal.ZonedDateTime>
    : A extends Distribution<unknown>
      ? Distribution<Temporal.ZonedDateTime>
      : Temporal.ZonedDateTime | undefined;
