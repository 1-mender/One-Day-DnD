import { z } from "zod";
import { parseRouteInput } from "./routeValidation.js";

export const backupImportBodySchema = z.object({}).passthrough();

export function parseBackupRouteInput(schema, input) {
  return parseRouteInput(schema, input);
}
