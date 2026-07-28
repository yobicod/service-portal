import assert from "node:assert/strict";
import test from "node:test";
import { requireWorkflowClaim, WorkflowConflictError } from "./workflow-mutation";

test("a workflow claim succeeds only when exactly one row was updated", () => {
  assert.doesNotThrow(() => requireWorkflowClaim({ count: 1 }));
  assert.throws(() => requireWorkflowClaim({ count: 0 }), WorkflowConflictError);
  assert.throws(() => requireWorkflowClaim({ count: 2 }), WorkflowConflictError);
});
