import { z } from "zod";
import { optionalScalarTextSchema, positiveIdSchema } from "./routeSchemaPrimitives.js";
import { parseRouteInput } from "./routeValidation.js";

export const playerIdParamsSchema = z.object({
  id: positiveIdSchema
});

export const playerRenameBodySchema = z.object({
  displayName: optionalScalarTextSchema
}).passthrough();

export function parsePlayersRouteInput(schema, input, error = "invalid_request") {
  return parseRouteInput(schema, input, error);
}
