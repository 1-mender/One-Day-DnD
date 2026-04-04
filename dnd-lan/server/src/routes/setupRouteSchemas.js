import { z } from "zod";
import { optionalScalarTextSchema } from "./routeSchemaPrimitives.js";
import { parseRouteInput } from "./routeValidation.js";

export const dmSetupBodySchema = z.object({
  username: optionalScalarTextSchema,
  password: optionalScalarTextSchema,
  setupSecret: optionalScalarTextSchema
}).passthrough();

export function parseSetupRouteInput(schema, input) {
  return parseRouteInput(schema, input);
}
