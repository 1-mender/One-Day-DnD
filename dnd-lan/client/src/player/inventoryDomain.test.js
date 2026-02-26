import test from "node:test";
import assert from "node:assert/strict";
import {
  applyLayoutMoves,
  filterIconSections,
  filterInventory,
  getItemAvailableQty,
  getSplitInputMax,
  summarizeInventory
} from "./inventoryDomain.js";

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

test("filterInventory applies visibility/rarity/query filters", () => {
  const items = [
    { id: 1, name: "Sword", visibility: "public", rarity: "common" },
    { id: 2, name: "Hidden Ring", visibility: "hidden", rarity: "rare" }
  ];
  assert.equal(filterInventory(items, { q: "", vis: "", rarity: "" }).length, 2);
  assert.equal(filterInventory(items, { q: "ring", vis: "", rarity: "" }).length, 1);
  assert.equal(filterInventory(items, { q: "", vis: "hidden", rarity: "rare" }).length, 1);
  assert.equal(filterInventory(items, { q: "", vis: "public", rarity: "rare" }).length, 0);
});

test("summarizeInventory returns totals and visibility counts", () => {
  const out = summarizeInventory([
    { qty: 2, weight: 1.5, visibility: "public" },
    { qty: 1, weight: 3, visibility: "hidden" }
  ]);
  assert.equal(out.totalWeight, 6);
  assert.equal(out.publicCount, 1);
  assert.equal(out.hiddenCount, 1);
});

test("applyLayoutMoves updates only moved rows", () => {
  const list = [{ id: 1, container: "backpack", slotX: 0, slotY: 0 }, { id: 2, container: "backpack", slotX: 1, slotY: 0 }];
  const out = applyLayoutMoves(list, [{ id: 2, container: "hotbar", slotX: 0, slotY: 0 }]);
  assert.equal(out[0].container, "backpack");
  assert.equal(out[1].container, "hotbar");
  assert.equal(out[1].slot_x, 0);
});

test("filterIconSections narrows icon catalog by query", () => {
  const sections = [{ key: "weapons", items: [{ key: "sword", label: "Sword" }, { key: "axe", label: "Axe" }] }];
  const out = filterIconSections(sections, "axe");
  assert.equal(out.length, 1);
  assert.equal(out[0].items.length, 1);
  assert.equal(out[0].items[0].key, "axe");
});
