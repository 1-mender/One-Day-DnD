import { z } from "zod";
import { emptyPassthroughObjectSchema, optionalScalarTextSchema } from "./routeSchemaPrimitives.js";
import { parseRouteInput } from "./routeValidation.js";

export const dmLoginBodySchema = z.object({
  username: optionalScalarTextSchema,
  password: optionalScalarTextSchema
}).passthrough();

export const changePasswordBodySchema = z.object({
  newPassword: optionalScalarTextSchema
}).passthrough();

export const playerSessionBodySchema = z.object({
  playerToken: optionalScalarTextSchema
}).passthrough();

export const emptyAuthBodySchema = emptyPassthroughObjectSchema;

export function parseAuthRouteInput(schema, input) {
  return parseRouteInput(schema, input);
}
