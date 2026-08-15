import { assertIdentical } from "@kensio/smartass";
import { describe, it } from "vitest";

import { packageName } from "./index.js";

describe("the placeholder entry point", () => {
  it("exports something, so that the toolchain has something to check", () => {
    assertIdentical(packageName, "@kensio/quando");
  });
});
