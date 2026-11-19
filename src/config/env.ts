
import { z } from "zod";

const optionalSecret = z.string().trim().optional();

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),

    PORT: z.coerce.number().int().min(1).max(65535).default(5000),

    CLIENT_URL: z.string().url(),

    MONGODB_URI: z
      .string()
      .trim()
      .min(1, "MONGODB_URI is required")
      .refine(
        (value) =>
          value.startsWith("mongodb://") ||
          value.startsWith("mongodb+srv://"),
        "MONGODB_URI must be a valid MongoDB connection URI"
      ),

    DB_NAME: z.string().trim().min(1).default("pizzahub"),

    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),

    BETTER_AUTH_URL: z.string().url(),

    GOOGLE_CLIENT_ID: optionalSecret,
    GOOGLE_CLIENT_SECRET: optionalSecret,

    IMGBB_API_KEY: optionalSecret,

    STRIPE_SECRET_KEY: optionalSecret,
    STRIPE_WEBHOOK_SECRET: optionalSecret,
    STRIPE_PRICE_ID: optionalSecret,

    ADMIN_EMAIL: z.string().trim().email(),
  })
  .superRefine((data, ctx) => {
    const googleClientId = Boolean(data.GOOGLE_CLIENT_ID);
    const googleClientSecret = Boolean(data.GOOGLE_CLIENT_SECRET);

    if (googleClientId !== googleClientSecret) {
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_SECRET"],
        message:
          "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together.",
      });
    }

    const stripeConfigured = [
      data.STRIPE_SECRET_KEY,
      data.STRIPE_WEBHOOK_SECRET,
      data.STRIPE_PRICE_ID,
    ].filter(Boolean).length;

    if (stripeConfigured > 0 && stripeConfigured < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["STRIPE_SECRET_KEY"],
        message:
          "All Stripe environment variables must be configured together.",
      });
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("\nInvalid environment configuration:");

  for (const issue of parsedEnv.error.issues) {
    console.error(`- ${issue.path.join(".")}: ${issue.message}`);
  }

  throw new Error("Environment validation failed. Check your .env file.");
}

export const env = parsedEnv.data;

export type Env = z.infer<typeof envSchema>;
