export const GAME_CATALOG = [
  {
    key: "ttt",
    title: "Tic-Tac-Toe: Mind Duel",
    blurb: "Best of 3 vs AI. A 2-0 sweep gives a bonus.",
    difficulty: "Easy",
    time: "2-4 min",
    risk: "Low",
    rules: [
      "Match to 2 round wins",
      "Draw means replay the round",
      "2-0 sweep applies a higher multiplier"
    ],
    modes: [
      { key: "normal", label: "Normal", roundsToWin: 2, ai: "standard" },
      { key: "fast", label: "Fast", roundsToWin: 1, ai: "standard" }
    ]
  },
  {
    key: "guess",
    title: "Guess the Card: Logic & Memory",
    blurb: "Hints help, but speed still matters.",
    difficulty: "Medium",
    time: "3-5 min",
    risk: "Medium",
    rules: [
      "Hints unlock by attempt number",
      "Earlier correct guess gives a better bonus",
      "Round duration is limited by a timer"
    ],
    modes: [
      { key: "easy", label: "Warmup", ranks: ["A", "K", "Q"], maxAttempts: 4, timeLimit: 50, hintCount: 3 },
      { key: "normal", label: "Classic", ranks: ["A", "K", "Q", "J"], maxAttempts: 3, timeLimit: 40, hintCount: 3 },
      { key: "hard", label: "Master", ranks: ["A", "K", "Q", "J", "10"], maxAttempts: 3, timeLimit: 32, hintCount: 2 }
    ]
  },
  {
    key: "match3",
    title: "Match-3: Chain Combos",
    blurb: "Long combo chains increase the final reward.",
    difficulty: "Medium",
    time: "4-6 min",
    risk: "Medium",
    rules: [
      "Limited moves per round",
      "Combo 4+ gives extra bonus",
      "Combo 5+ gives max multiplier"
    ],
    modes: [
      { key: "normal", label: "Classic", size: 6, moves: 18, target: 120, colors: 6, blocks: 0 },
      { key: "compact", label: "Compact", size: 5, moves: 14, target: 90, colors: 5, blocks: 0 },
      { key: "chaos", label: "Chaos", size: 7, moves: 20, target: 180, colors: 7, blocks: 6 }
    ]
  },
  {
    key: "uno",
    title: "Uno Mini: Quick Match",
    blurb: "Drop all cards faster than your opponent.",
    difficulty: "Medium",
    time: "5-7 min",
    risk: "Medium",
    rules: [
      "Win by reaching zero cards",
      "Extra draws increase risk",
      "Clean win gives bonus"
    ],
    modes: [
      { key: "normal", label: "Classic", handSize: 5, ai: "standard" }
    ]
  },
  {
    key: "scrabble",
    title: "Scrabble Blitz: Word in a Minute",
    blurb: "Build a word from a random letter rack.",
    difficulty: "Hard",
    time: "2-3 min",
    risk: "High",
    rules: [
      "You have 60 seconds to submit a word",
      "Long words provide a bonus",
      "Rare letters boost reward"
    ],
    modes: [
      { key: "normal", label: "Classic", timeLimit: 60, rackSize: 7 }
    ]
  }
];

export function validateGameCatalog(list = GAME_CATALOG) {
  if (!Array.isArray(list) || list.length === 0) throw new Error("Game catalog is empty.");
  const seen = new Set();
  for (const game of list) {
    if (!game?.key || !game?.title) throw new Error("Game catalog entry missing key/title.");
    if (seen.has(game.key)) throw new Error(`Duplicate game key: ${game.key}`);
    seen.add(game.key);
    if (!Array.isArray(game.rules)) throw new Error(`Game ${game.key} is missing rules.`);
    if (!Array.isArray(game.modes) || game.modes.length === 0) {
      throw new Error(`Game ${game.key} is missing modes.`);
    }
  }
}
