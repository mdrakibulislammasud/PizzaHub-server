import { z } from "zod";

export const menuCategories = [
  "Classic Pizzas",
  "Vegetarian Pizzas",
  "Meat Lovers",
  "Specialty / Gourmet Pizzas",
  "Sides & Appetizers",
  "Beverages & Desserts",
] as const;

export const createMenuItemSchema = z.object({
  itemName: z
    .string()
    .trim()
    .min(3, "Item name must be at least 3 characters.")
    .max(100, "Item name cannot exceed 100 characters."),

  category: z.enum(menuCategories),

  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters.")
    .max(1000, "Description cannot exceed 1000 characters."),

  price: z
    .number()
    .finite()
    .positive("Price must be greater than 0."),

  location: z
    .string()
    .trim()
    .min(2, "Location is required.")
    .max(150, "Location cannot exceed 150 characters."),

  images: z
    .array(z.string().url("Each image must be a valid URL."))
    .min(1, "At least one menu image is required."),
});

export const updateMenuItemSchema = createMenuItemSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field is required to update.",
  );

export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;

export const createMenuItemFieldsSchema = createMenuItemSchema.omit({
  images: true,
});

export const updateMenuItemStatusSchema = z.object({
  status: z.enum([
    "pending",
    "approved",
    "rejected",
    "inactive",
  ]),
});

export type UpdateMenuItemStatusInput = z.infer<typeof updateMenuItemStatusSchema>; 
