import { z } from "zod";

export const adminUserQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.enum(["customer", "vendor", "admin"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const updateUserBlockStatusSchema = z.object({
  isBlocked: z.boolean(),
});

export const adminUserIdSchema = z.string().uuid();

export type AdminUserQueryInput = z.infer<
  typeof adminUserQuerySchema
>;

export type UpdateUserBlockStatusInput = z.infer<
  typeof updateUserBlockStatusSchema
>;
