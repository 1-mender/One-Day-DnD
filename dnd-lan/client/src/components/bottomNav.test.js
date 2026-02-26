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

test("partitionNavItems uses first five items when primaries are not marked", () => {
  const { primary, secondary } = partitionNavItems([
    { to: "/a", label: "A" },
    { to: "/b", label: "B" },
    { to: "/c", label: "C" },
    { to: "/d", label: "D" },
    { to: "/e", label: "E" },
    { to: "/f", label: "F" }
  ]);
  assert.deepEqual(primary.map((item) => item.to), ["/a", "/b", "/c", "/d", "/e"]);
  assert.deepEqual(secondary.map((item) => item.to), ["/f"]);
});

test("partitionNavItems prioritizes explicit primaries and fills to five", () => {
  const { primary, secondary } = partitionNavItems([
    { to: "/a", label: "A", primary: true },
    { to: "/b", label: "B", primary: true },
    { to: "/c", label: "C" },
    { to: "/d", label: "D" },
    { to: "/e", label: "E" },
    { to: "/f", label: "F" }
  ]);
  assert.deepEqual(primary.map((item) => item.to), ["/a", "/b", "/c", "/d", "/e"]);
  assert.deepEqual(secondary.map((item) => item.to), ["/f"]);
});
