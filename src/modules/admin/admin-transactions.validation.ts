import { z } from "zod";

export const adminTransactionQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(["pending", "paid", "failed", "cancelled"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type AdminTransactionQueryInput = z.infer<
  typeof adminTransactionQuerySchema
>;
