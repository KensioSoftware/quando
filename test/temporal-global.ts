// The floor runtime has no global `Temporal`, so the suite installs one there
// the same way a consumer on that runtime does. See the polyfill section in
// docs/getting-started/ for the consumer-facing version of this.
//
// `??=` rather than `=`, because `temporal-polyfill` re-exports the native
// `Temporal` where the runtime has one. The development runtime keeps testing
// against the real implementation.
//
// The cast is the interesting part. `lib: ["ESNext"]` declares a global
// `Temporal` unconditionally, which is what makes the assignment below look
// dead to the type checker. That declaration is a claim about the runtime, and
// the floor runtime is where it stops being true.
import { Temporal as polyfilled } from "temporal-polyfill";

const globals = globalThis as { Temporal?: typeof globalThis.Temporal };

globals.Temporal ??= polyfilled;
