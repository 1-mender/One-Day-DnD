import test from "node:test";
import assert from "node:assert/strict";
import { getTrapFocusTarget, shouldCloseOnBackdropMouseDown } from "./modalA11y.js";

test("getTrapFocusTarget cycles focus forward from the last element", () => {
  const a = { id: "a" };
  const b = { id: "b" };
  const c = { id: "c" };
  const target = getTrapFocusTarget([a, b, c], c, false);
  assert.equal(target, a);
});

test("getTrapFocusTarget cycles focus backward from the first element", () => {
  const a = { id: "a" };
  const b = { id: "b" };
  const c = { id: "c" };
  const target = getTrapFocusTarget([a, b, c], a, true);
  assert.equal(target, c);
});

test("getTrapFocusTarget does nothing when no wrap is needed", () => {
  const a = { id: "a" };
  const b = { id: "b" };
  const c = { id: "c" };
  assert.equal(getTrapFocusTarget([a, b, c], b, false), null);
  assert.equal(getTrapFocusTarget([a, b, c], b, true), null);
});

test("shouldCloseOnBackdropMouseDown closes only when clicking backdrop", () => {
  const backdrop = { id: "backdrop" };
  const child = { id: "child" };
  assert.equal(shouldCloseOnBackdropMouseDown(backdrop, backdrop), true);
  assert.equal(shouldCloseOnBackdropMouseDown(child, backdrop), false);
});
