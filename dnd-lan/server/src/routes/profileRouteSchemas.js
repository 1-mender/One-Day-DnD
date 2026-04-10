import { z } from "zod";
import {
  emptyPassthroughObjectSchema,
  optionalPositiveLimitSchema,
  optionalShortStatusSchema,
  positiveIdSchema
} from "./routeSchemaPrimitives.js";
import { parseRouteInput } from "./routeValidation.js";

export const playerIdParamsSchema = z.object({
  id: positiveIdSchema
});

export const profileRequestIdParamsSchema = z.object({
  id: positiveIdSchema
});

export const dmProfilePresetsBodySchema = z.object({
  reset: z.boolean().optional(),
  access: z.unknown().optional(),
  presets: z.unknown().optional()
}).passthrough();

export const profileUpsertBodySchema = z.object({
  characterName: z.unknown().optional(),
  classRole: z.unknown().optional(),
  level: z.unknown().optional(),
  stats: z.unknown().optional(),
  bio: z.unknown().optional(),
  avatarUrl: z.unknown().optional(),
  publicFields: z.unknown().optional(),
  publicBlurb: z.unknown().optional(),
  editableFields: z.unknown().optional(),
  allowRequests: z.unknown().optional()
}).passthrough();

export const profilePatchBodySchema = emptyPassthroughObjectSchema;

export const playerProfileRequestCreateBodySchema = z.object({
  reason: z.unknown().optional(),
  proposedChanges: z.unknown().optional()
}).passthrough();

export const profileRequestsQuerySchema = z.object({
  status: optionalShortStatusSchema,
  limit: optionalPositiveLimitSchema
}).passthrough();

export const profileRequestResolutionBodySchema = z.object({
  note: z.unknown().optional()
}).passthrough();

export function parseProfileRouteInput(schema, input, error = "invalid_request") {
  return parseRouteInput(schema, input, error);
}
