import assert from "node:assert/strict";
import test from "node:test";
import {
  ATTACHMENT_MAX_BYTES,
  attachmentSelectionError,
} from "./attachment-selection";

test("attachmentSelectionError accepts supported files within 10MB", () => {
  assert.equal(
    attachmentSelectionError({
      type: "image/png",
      size: ATTACHMENT_MAX_BYTES,
    }),
    null,
  );
  assert.equal(
    attachmentSelectionError({ type: "application/pdf", size: 100 }),
    null,
  );
});

test("attachmentSelectionError identifies invalid type and oversized files", () => {
  assert.equal(
    attachmentSelectionError({ type: "text/plain", size: 100 }),
    "type",
  );
  assert.equal(
    attachmentSelectionError({
      type: "image/jpeg",
      size: ATTACHMENT_MAX_BYTES + 1,
    }),
    "size",
  );
});
