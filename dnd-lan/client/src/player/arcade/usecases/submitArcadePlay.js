import { formatError } from "../../../lib/formatError.js";
import { formatTicketError } from "../domain/arcadeFormatters.js";

export async function submitArcadePlay({
  play,
  toast,
  gameKey,
  outcome,
  performance,
  payload,
  seed,
  proof,
  ticketsEnabled
}) {
  if (!ticketsEnabled) {
    throw new Error("Аркада закрыта DM.");
  }

  try {
    const res = await play({
      gameKey,
      outcome,
      performance: performance || "normal",
      payload,
      seed,
      proof
    });
    const result = res?.result;
    if (result?.outcome === "win") {
      toast?.success?.(`+${result.reward} билетов (x${result.multiplier})`, "Победа");
    } else if (result) {
      toast?.warn?.(`-${result.penalty + result.entryCost} билетов`, "Поражение");
    }
    return result;
  } catch (e) {
    const msg = formatTicketError(formatError(e));
    throw new Error(msg);
  }
}
