import test from "node:test";
import assert from "node:assert/strict";
import { filterTransfers } from "./dmInventoryDomain.js";

test("filterTransfers matches item, player names, notes and ids", () => {
  const transfers = [
    { id: 1, itemName: "Healing Potion", fromName: "Alice", toName: "Bob", note: "urgent", fromPlayerId: 10, toPlayerId: 12 },
    { id: 2, itemName: "Rope", fromName: "Cara", toName: "Dax", note: "", fromPlayerId: 20, toPlayerId: 21 }
  ];

  assert.deepEqual(filterTransfers(transfers, "").map((item) => item.id), [1, 2]);
  assert.deepEqual(filterTransfers(transfers, "bob").map((item) => item.id), [1]);
  assert.deepEqual(filterTransfers(transfers, "urgent").map((item) => item.id), [1]);
  assert.deepEqual(filterTransfers(transfers, "21").map((item) => item.id), [2]);
});
