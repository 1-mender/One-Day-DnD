import test from "node:test";
import assert from "node:assert/strict";
import { getPopoverTabTarget } from "./navPopoverA11y.js";

test("getPopoverTabTarget wraps forward from the last item", () => {
  const a = { id: "a" };
  const b = { id: "b" };
  const c = { id: "c" };
  const target = getPopoverTabTarget([a, b, c], c, false);
  assert.equal(target, a);
});

test("getPopoverTabTarget wraps backward from the first item", () => {
  const a = { id: "a" };
  const b = { id: "b" };
  const c = { id: "c" };
  const target = getPopoverTabTarget([a, b, c], a, true);
  assert.equal(target, c);
});

test("getPopoverTabTarget restores focus into popover when active is outside", () => {
  const a = { id: "a" };
  const b = { id: "b" };
  const outside = { id: "outside" };
  assert.equal(getPopoverTabTarget([a, b], outside, false), a);
  assert.equal(getPopoverTabTarget([a, b], outside, true), b);
});
