import test from "node:test";
import assert from "node:assert/strict";
import {
  filterDmPlayers,
  getDmPlayerSearchHaystack,
  matchesDmPlayerFlag,
  sortDmPlayers
} from "./dmPlayersDomain.js";

const players = [
  {
    id: 11,
    displayName: "Nik",
    characterName: "Aria",
    classRole: "Mage",
    status: "offline",
    profileExists: true,
    shieldActive: false,
    specializationAvailable: false,
    pendingRequestCount: 0
  },
  {
    id: 12,
    displayName: "Dima",
    characterName: "Brom",
    classRole: "Warrior",
    status: "online",
    profileExists: false,
    shieldActive: true,
    specializationAvailable: true,
    pendingRequestCount: 2
  },
  {
    id: 13,
    displayName: "Ira",
    characterName: "Shade",
    classRole: "Rogue",
    status: "idle",
    profileExists: true,
    shieldActive: false,
    specializationAvailable: false,
    pendingRequestCount: 1,
    specializationRole: { key: "striker", label: "Страйкер" }
  }
];

test("getDmPlayerSearchHaystack includes account, character, role and id", () => {
  const haystack = getDmPlayerSearchHaystack(players[0]);
  assert.match(haystack, /nik/);
  assert.match(haystack, /aria/);
  assert.match(haystack, /mage/);
  assert.match(haystack, /11/);
});

test("filterDmPlayers searches character and class role", () => {
  assert.deepEqual(filterDmPlayers(players, { query: "aria" }).map((player) => player.id), [11]);
  assert.deepEqual(filterDmPlayers(players, { query: "warrior" }).map((player) => player.id), [12]);
  assert.deepEqual(filterDmPlayers(players, { query: "#13" }).map((player) => player.id), [13]);
});

test("matchesDmPlayerFlag supports operational filters", () => {
  assert.equal(matchesDmPlayerFlag(players[1], "no_profile"), true);
  assert.equal(matchesDmPlayerFlag(players[1], "shield"), true);
  assert.equal(matchesDmPlayerFlag(players[1], "specialization"), true);
  assert.equal(matchesDmPlayerFlag(players[1], "requests"), true);
  assert.equal(matchesDmPlayerFlag(players[0], "requests"), false);
});

test("filterDmPlayers combines status, role and flag filters", () => {
  assert.deepEqual(
    filterDmPlayers(players, { status: "idle", role: "striker", flag: "requests" }).map((player) => player.id),
    [13]
  );
});

test("sortDmPlayers raises urgent players to the top", () => {
  assert.deepEqual(sortDmPlayers(players).map((player) => player.id), [12, 13, 11]);
});
