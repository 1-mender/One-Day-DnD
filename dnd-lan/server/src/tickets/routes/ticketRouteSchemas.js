import { z } from "zod";
import { positiveIdSchema } from "../../routes/routeSchemaPrimitives.js";
import { parseRouteInput } from "../../routes/routeValidation.js";

const shortTextSchema = z.string().trim().max(64);
const sessionIdSchema = z.string().trim().regex(/^[a-f0-9]{32}$/i);

export const gameStartParamsSchema = z.object({
  gameKey: shortTextSchema.min(1)
});

export const gameStartBodySchema = z.object({
  modeKey: shortTextSchema.optional()
}).passthrough();

export const sessionParamsSchema = z.object({
  sessionId: sessionIdSchema
});

export const sessionMoveBodySchema = z.object({}).passthrough();

export const queueJoinBodySchema = z.object({
  gameKey: shortTextSchema.min(1),
  modeKey: shortTextSchema.optional(),
  skillBand: shortTextSchema.max(24).optional()
}).passthrough();

export const queueCancelBodySchema = z.object({
  queueId: z.union([positiveIdSchema, z.null()]).optional()
}).passthrough();

export const matchIdParamsSchema = z.object({
  matchId: positiveIdSchema
});

export const matchCompleteBodySchema = z.object({
  outcome: shortTextSchema.optional(),
  durationMs: z.coerce.number().int().min(0).max(24 * 60 * 60 * 1000).nullable().optional(),
  winnerPlayerId: z.union([positiveIdSchema, z.null()]).optional()
}).passthrough();

export const purchaseBodySchema = z.object({
  itemKey: shortTextSchema.min(1)
}).passthrough();

export const matchHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional()
}).passthrough();

export function parseTicketRouteInput(schema, input) {
  return parseRouteInput(schema, input);
}
