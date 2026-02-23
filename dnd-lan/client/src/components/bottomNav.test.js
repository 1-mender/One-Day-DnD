import test from "node:test";
import assert from "node:assert/strict";
import { partitionNavItems } from "./bottomNavDomain.js";

test("partitionNavItems keeps only valid nav entries", () => {
  const { normalized } = partitionNavItems([
    { to: "/a", label: "A" },
    { to: "/b" },
    null,
    { label: "C" }
  ]);
  assert.equal(normalized.length, 1);
});

test("partitionNavItems uses first four items when primaries are not marked", () => {
  const { primary, secondary } = partitionNavItems([
    { to: "/a", label: "A" },
    { to: "/b", label: "B" },
    { to: "/c", label: "C" },
    { to: "/d", label: "D" },
    { to: "/e", label: "E" }
  ]);
  assert.deepEqual(primary.map((item) => item.to), ["/a", "/b", "/c", "/d"]);
  assert.deepEqual(secondary.map((item) => item.to), ["/e"]);
});

test("partitionNavItems respects explicit primary markers", () => {
  const { primary, secondary } = partitionNavItems([
    { to: "/a", label: "A", primary: true },
    { to: "/b", label: "B", primary: true },
    { to: "/c", label: "C" },
    { to: "/d", label: "D" }
  ]);
  assert.deepEqual(primary.map((item) => item.to), ["/a", "/b"]);
  assert.deepEqual(secondary.map((item) => item.to), ["/c", "/d"]);
});
