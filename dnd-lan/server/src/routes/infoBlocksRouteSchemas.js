import { z } from "zod";
import { positiveIdSchema } from "./routeSchemaPrimitives.js";
import { parseRouteInput } from "./routeValidation.js";

export const infoBlockIdParamsSchema = z.object({
  id: positiveIdSchema
});

export const infoBlockBodySchema = z.object({
  title: z.unknown().optional(),
  content: z.unknown().optional(),
  category: z.unknown().optional(),
  access: z.unknown().optional(),
  selectedPlayerIds: z.unknown().optional(),
  tags: z.unknown().optional()
}).passthrough();

export function parseInfoBlocksRouteInput(schema, input, error = "invalid_request") {
  return parseRouteInput(schema, input, error);
}
