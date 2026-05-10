import { z } from "zod";
import { optionalScalarTextSchema, positiveIdSchema } from "./routeSchemaPrimitives.js";
import { parseRouteInput } from "./routeValidation.js";

export const bestiaryListQuerySchema = z.object({
  q: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
  includeImages: optionalScalarTextSchema,
  imagesLimit: z.coerce.number().int().min(0).optional()
}).passthrough();

export const bestiaryImagesQuerySchema = z.object({
  ids: optionalScalarTextSchema,
  limitPer: z.coerce.number().int().min(0).optional()
}).passthrough();

export const monsterBodySchema = z.object({
  name: z.unknown().optional(),
  type: z.unknown().optional(),
  habitat: z.unknown().optional(),
  cr: z.unknown().optional(),
  stats: z.unknown().optional(),
  abilities: z.unknown().optional(),
  description: z.unknown().optional(),
  is_hidden: z.unknown().optional()
}).passthrough();

export const monsterIdParamsSchema = z.object({
  id: positiveIdSchema
});

export const bestiarySettingsToggleBodySchema = z.object({
  enabled: z.unknown().optional()
}).passthrough();

export function parseBestiaryRouteInput(schema, input, error = "invalid_request") {
  return parseRouteInput(schema, input, error);
}
