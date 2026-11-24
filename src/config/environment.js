
require("dotenv").config();

const { z } = require("zod");

const schema = z.object({
  NODE_ENV: z.enum([
    "development",
    "test",
    "production"
  ]).default("development"),

  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1),

  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("7d"),

  ALLOWED_ORIGINS: z.string().default(
    "http://localhost:5173"
  ),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),

  PAYMENT_PROVIDER: z.enum([
    "maya",
    "mock"
  ]).default("maya"),

  MAYA_ENV: z.enum([
    "sandbox",
    "production"
  ]).default("sandbox"),

  MAYA_PUBLIC_KEY: z.string().optional(),
MAYA_SECRET_KEY: z.string().optional(),
MAYA_WEBHOOK_SECRET: z.string().optional(),

MAYA_BASE_URL: z.string().url().default(
  "https://pg-sandbox.paymaya.com"
),

MAYA_REDIRECT_BASE_URL: z.string().url().optional(),

  MAYA_SUCCESS_URL: z.string().url().optional(),
  MAYA_CANCEL_URL: z.string().url().optional(),

// Google Gemini AI
GEMINI_API_KEY: z.string().min(1).optional(),

GEMINI_MODEL: z.string().default(
  "gemini-2.5-flash"
),

  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional(),

  OPENROUTER_BASE_URL: z.string().url().default(
    "https://openrouter.ai/api/v1"
  ),

  APP_BASE_URL: z.string().url().optional(),
  API_BASE_URL: z.string().url().optional()
});

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error(
    "Invalid environment configuration:",
    result.error.flatten().fieldErrors
  );

  process.exit(1);
}

module.exports = result.data;
