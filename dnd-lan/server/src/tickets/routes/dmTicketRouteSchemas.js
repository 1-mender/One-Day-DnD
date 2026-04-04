import { z } from "zod";
import { parseTicketRouteInput } from "./ticketRouteSchemas.js";

const shortTextSchema = z.string().trim().max(64);
const dayKeySchema = z.coerce.number().int().positive();
const playerIdSchema = z.coerce.number().int().positive();

export const dmMetricsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).optional()
}).passthrough();

export const dmRulesBodySchema = z.object({
  enabled: z.boolean().optional(),
  reset: z.boolean().optional(),
  rules: z.record(z.string(), z.unknown()).optional()
}).passthrough();

export const dmQuestBodySchema = z.object({
  questKey: shortTextSchema.min(1)
}).passthrough();

export const dmQuestResetBodySchema = z.object({
  questKey: shortTextSchema.optional(),
  dayKey: dayKeySchema.optional()
}).passthrough();

export const dmAdjustBodySchema = z.object({
  playerId: playerIdSchema,
  delta: z.coerce.number().int().min(-1000000).max(1000000).optional(),
  set: z.coerce.number().int().min(0).max(1000000).nullable().optional(),
  reason: z.string().trim().max(280).optional()
}).passthrough();

export { parseTicketRouteInput };
