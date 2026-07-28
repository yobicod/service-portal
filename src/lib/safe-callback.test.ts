import assert from "node:assert/strict";
import test from "node:test";
import { safeCallbackPath } from "./safe-callback";

const origin = "https://portal.example.test";

test("safeCallbackPath keeps same-origin absolute paths", () => {
  assert.equal(safeCallbackPath("/admin", origin), "/admin");
  assert.equal(
    safeCallbackPath("https://portal.example.test/admin?from=proxy", origin),
    "/admin?from=proxy",
  );
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
    "https://portal.example.test.attacker.example/admin",
    "//attacker.example",
    "/\\attacker.example",
    "javascript:alert(1)",
    "not a local path",
    "http://[invalid",
  ]) {
    assert.equal(safeCallbackPath(callbackUrl, origin), "/");
  }
});
