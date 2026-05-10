import { z } from "zod";

export const emptyPassthroughObjectSchema = z.object({}).passthrough();
export const positiveIdSchema = z.coerce.number().int().positive();
export const optionalScalarTextSchema = z.union([z.string(), z.number(), z.boolean()]).optional();
export const optionalNullableIdSchema = z.union([z.string(), z.number(), z.null()]).optional();
export const optionalShortStatusSchema = z.string().trim().max(40).optional();
export const optionalPositiveLimitSchema = z.coerce.number().int().positive().optional();
