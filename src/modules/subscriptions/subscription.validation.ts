import { z } from "zod";

// The vendor cannot choose the price or vendor ID.
// Both will be determined securely by the backend.
export const createCheckoutSchema = z.object({}).strict();

export type CreateCheckoutInput = z.infer<
  typeof createCheckoutSchema
>;
