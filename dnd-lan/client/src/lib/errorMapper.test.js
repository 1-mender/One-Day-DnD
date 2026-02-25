import test from "node:test";
import assert from "node:assert/strict";
import { mapError } from "./errorMapper.js";

test("mapError resolves inventory conflict messages", () => {
  const slotOccupied = mapError({ body: { error: "slot_occupied" } });
  assert.equal(slotOccupied.code, "slot_occupied");
  assert.match(slotOccupied.message, /слот/i);
  assert.ok(slotOccupied.hint);

  const invalidEquipment = mapError({ body: { error: "invalid_equipment_slot" } });
  assert.equal(invalidEquipment.code, "invalid_equipment_slot");
  assert.match(invalidEquipment.message, /экипиров/i);
  assert.ok(invalidEquipment.hint);
});

test("mapError resolves inventory qty and equipability messages", () => {
  const invalidQty = mapError({ body: { error: "invalid_qty" } });
  assert.equal(invalidQty.code, "invalid_qty");
  assert.match(invalidQty.message, /количеств/i);

  const reserved = mapError({ body: { error: "reserved_qty_exceeded" } });
  assert.equal(reserved.code, "reserved_qty_exceeded");
  assert.match(reserved.message, /зарезерв/i);

  const equipable = mapError({ body: { error: "not_equipable" } });
  assert.equal(equipable.code, "not_equipable");
  assert.match(equipable.message, /экипир/i);
});
