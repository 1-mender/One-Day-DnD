export const DAY_MS = 24 * 60 * 60 * 1000;
export const SEED_TTL_MS = 10 * 60 * 1000;
export const ARCADE_QUEUE_TTL_MS = Number(process.env.ARCADE_QUEUE_TTL_MS || 2 * 60 * 1000);
export const ARCADE_HISTORY_LIMIT = Number(process.env.ARCADE_HISTORY_LIMIT || 20);
export const ARCADE_QUEUE_ETA_SEC = Number(process.env.ARCADE_QUEUE_ETA_SEC || 12);
export const ARCADE_METRICS_DAYS = Number(process.env.ARCADE_METRICS_DAYS || 7);
export const MIN_ARCADE_PLAY_MS = Object.freeze({
  guess: Number(process.env.TICKETS_MIN_PLAY_MS_GUESS || 0),
  ttt: Number(process.env.TICKETS_MIN_PLAY_MS_TTT || 0),
  match3: Number(process.env.TICKETS_MIN_PLAY_MS_MATCH3 || 0),
  uno: Number(process.env.TICKETS_MIN_PLAY_MS_UNO || 0),
  scrabble: Number(process.env.TICKETS_MIN_PLAY_MS_SCRABBLE || 0)
});
