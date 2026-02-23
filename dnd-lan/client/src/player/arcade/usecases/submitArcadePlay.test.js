import test from "node:test";
import assert from "node:assert/strict";
import { submitArcadePlay } from "./submitArcadePlay.js";

function createToastSpy() {
  const calls = [];
  return {
    calls,
    toast: {
      success: (message, title) => calls.push({ type: "success", message, title }),
      warn: (message, title) => calls.push({ type: "warn", message, title }),
      error: (message, title) => calls.push({ type: "error", message, title })
    }
  };
}

test("submitArcadePlay rejects when arcade is disabled", async () => {
  const { toast } = createToastSpy();
  await assert.rejects(
    () => submitArcadePlay({
      play: async () => ({ result: null }),
      toast,
      gameKey: "ttt",
      outcome: "win",
      performance: "normal",
      payload: {},
      ticketsEnabled: false
    }),
    (error) => error instanceof Error
  );
});

test("submitArcadePlay sends success toast for win result", async () => {
  const { toast, calls } = createToastSpy();
  const result = await submitArcadePlay({
    play: async () => ({ result: { outcome: "win", reward: 7, multiplier: 2 } }),
    toast,
    gameKey: "ttt",
    outcome: "win",
    performance: "normal",
    payload: {},
    ticketsEnabled: true
  });

  assert.equal(result.reward, 7);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, "success");
});

test("submitArcadePlay sends warning toast for non-win result", async () => {
  const { toast, calls } = createToastSpy();
  const result = await submitArcadePlay({
    play: async () => ({ result: { outcome: "loss", penalty: 2, entryCost: 1 } }),
    toast,
    gameKey: "ttt",
    outcome: "loss",
    performance: "normal",
    payload: {},
    ticketsEnabled: true
  });

  assert.equal(result.outcome, "loss");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, "warn");
});
