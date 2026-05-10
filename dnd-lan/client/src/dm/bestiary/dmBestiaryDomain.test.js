import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_BESTIARY_FORM, filterBestiary } from "./dmBestiaryDomain.js";

test("EMPTY_BESTIARY_FORM keeps expected shape", () => {
  assert.deepEqual(EMPTY_BESTIARY_FORM, {
    name: "",
    type: "",
    habitat: "",
    cr: "",
    description: "",
    abilities: [],
    stats: {},
    is_hidden: false
  });
});

test("filterBestiary filters by visibility and free-text haystack", () => {
  const items = [
    { id: 1, name: "Wolf", type: "Beast", habitat: "Forest", cr: "1/4", description: "Fast hunter", abilities: ["Pack Tactics"], is_hidden: false },
    { id: 2, name: "Wraith", type: "Undead", habitat: "Crypt", cr: "5", description: "Life drain", abilities: ["Incorporeal"], is_hidden: true }
  ];

  assert.deepEqual(filterBestiary(items, "", "").map((item) => item.id), [1, 2]);
  assert.deepEqual(filterBestiary(items, "pack", "").map((item) => item.id), [1]);
  assert.deepEqual(filterBestiary(items, "crypt", "hidden").map((item) => item.id), [2]);
  assert.deepEqual(filterBestiary(items, "wolf", "hidden"), []);
});
