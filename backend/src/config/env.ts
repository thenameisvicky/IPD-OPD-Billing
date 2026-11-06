import { config } from "dotenv";
config();

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(8090),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default("12h"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  CORS_ORIGIN: z.string().default("http://localhost:3009"),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: process.env.PORT,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  NODE_ENV: process.env.NODE_ENV,
  LOG_LEVEL: process.env.LOG_LEVEL,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
});
