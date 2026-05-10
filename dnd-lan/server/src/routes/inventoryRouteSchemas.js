import { z } from "zod";
import {
  emptyPassthroughObjectSchema,
  optionalShortStatusSchema,
  positiveIdSchema
} from "./routeSchemaPrimitives.js";
import { parseRouteInput } from "./routeValidation.js";

export const playerIdParamsSchema = z.object({
  playerId: positiveIdSchema
});

export const itemIdParamsSchema = z.object({
  id: positiveIdSchema
});

export const dmItemParamsSchema = z.object({
  playerId: positiveIdSchema,
  id: positiveIdSchema
});

export const transferIdParamsSchema = z.object({
  id: positiveIdSchema
});

export const inventoryItemBodySchema = z.object({
  name: z.unknown().optional(),
  qty: z.unknown().optional(),
  weight: z.unknown().optional(),
  rarity: z.unknown().optional(),
  visibility: z.unknown().optional(),
  tags: z.unknown().optional(),
  description: z.unknown().optional(),
  imageUrl: z.unknown().optional(),
  image_url: z.unknown().optional(),
  container: z.unknown().optional(),
  inv_container: z.unknown().optional(),
  slotX: z.unknown().optional(),
  slot_x: z.unknown().optional(),
  slotY: z.unknown().optional(),
  slot_y: z.unknown().optional()
}).passthrough();

export const inventoryLayoutBodySchema = z.object({
  moves: z.unknown().optional()
}).passthrough();

export const inventorySplitBodySchema = z.object({
  qty: z.unknown().optional(),
  container: z.unknown().optional(),
  inv_container: z.unknown().optional(),
  slotX: z.unknown().optional(),
  slot_x: z.unknown().optional(),
  slotY: z.unknown().optional(),
  slot_y: z.unknown().optional()
}).passthrough();

export const dmBulkVisibilityBodySchema = z.object({
  visibility: z.unknown().optional(),
  itemIds: z.unknown().optional()
}).passthrough();

export const dmBulkDeleteBodySchema = z.object({
  itemIds: z.unknown().optional()
}).passthrough();

export const transferCreateBodySchema = z.object({
  to_player_id: z.unknown().optional(),
  item_id: z.unknown().optional(),
  qty: z.unknown().optional(),
  note: z.unknown().optional()
}).passthrough();

export const dmTransfersQuerySchema = z.object({
  status: optionalShortStatusSchema
}).passthrough();

export const emptyBodySchema = emptyPassthroughObjectSchema;

export function parseInventoryRouteInput(schema, input, error = "invalid_request") {
  return parseRouteInput(schema, input, error);
}
