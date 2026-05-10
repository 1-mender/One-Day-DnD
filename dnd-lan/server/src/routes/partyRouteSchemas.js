import { z } from "zod";
import { optionalNullableIdSchema, optionalScalarTextSchema } from "./routeSchemaPrimitives.js";
import { parseRouteInput } from "./routeValidation.js";

export const joinRequestBodySchema = z.object({
  displayName: optionalScalarTextSchema,
  joinCode: optionalScalarTextSchema
}).passthrough();

export const joinRequestDecisionBodySchema = z.object({
  joinRequestId: optionalScalarTextSchema
}).passthrough();

export const playerActionBodySchema = z.object({
  playerId: optionalNullableIdSchema
}).passthrough();

export const joinCodeBodySchema = z.object({
  joinCode: optionalScalarTextSchema
}).passthrough();

export const impersonateBodySchema = z.object({
  playerId: optionalNullableIdSchema,
  mode: optionalScalarTextSchema
}).passthrough();

export function parsePartyRouteInput(schema, input) {
  return parseRouteInput(schema, input);
}
