import test from "node:test";
import assert from "node:assert/strict";
import { backupImportBodySchema, parseBackupRouteInput } from "../src/routes/backupRouteSchemas.js";

test("backup route schema accepts multipart field bags", () => {
  assert.deepEqual(parseBackupRouteInput(backupImportBodySchema, { note: "restore" }), {
    ok: true,
    data: { note: "restore" }
  });
});

test("backup route schema rejects non-object payload containers", () => {
  assert.deepEqual(parseBackupRouteInput(backupImportBodySchema, "bad"), {
    ok: false,
    error: "invalid_request"
  });
});
