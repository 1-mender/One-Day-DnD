import test from "node:test";
import assert from "node:assert/strict";
import { getItemAvailableQty, getSplitInputMax } from "./inventoryDomain.js";

test("getItemAvailableQty subtracts reserved qty", () => {
  assert.equal(getItemAvailableQty({ qty: 5, reserved_qty: 3 }), 2);
  assert.equal(getItemAvailableQty({ qty: 2, reservedQty: 1 }), 1);
  assert.equal(getItemAvailableQty({ qty: 1, reservedQty: 9 }), 0);
});

test("getSplitInputMax respects reserved qty availability", () => {
  assert.equal(getSplitInputMax({ qty: 5, reserved_qty: 3 }), 1);
  assert.equal(getSplitInputMax({ qty: 8, reserved_qty: 2 }), 5);
  assert.equal(getSplitInputMax({ qty: 1, reserved_qty: 0 }), 1);
});
