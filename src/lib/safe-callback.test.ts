import assert from "node:assert/strict";
import test from "node:test";
import { safeCallbackPath } from "./safe-callback";

const origin = "https://portal.example.test";

test("safeCallbackPath keeps same-origin absolute paths", () => {
  assert.equal(safeCallbackPath("/admin", origin), "/admin");
  assert.equal(
    safeCallbackPath("/staff?view=queue#current", origin),
    "/staff?view=queue#current",
  );
});

test("safeCallbackPath rejects external and malformed destinations", () => {
  for (const callbackUrl of [
    undefined,
    "",
    "https://attacker.example",
    "//attacker.example",
    "/\\attacker.example",
    "javascript:alert(1)",
  ]) {
    assert.equal(safeCallbackPath(callbackUrl, origin), "/");
  }
});
