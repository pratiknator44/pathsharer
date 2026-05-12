import dotenv from "dotenv";

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env variable: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  NODE_ENV: optional("NODE_ENV", "development"),
  PORT: parseInt(optional("PORT", "5000"), 10),
  MONGO_URI: required("MONGO_URI"),
  JWT_SECRET: required("JWT_SECRET"),
  RATE_LIMIT_WINDOW_MS: parseInt(optional("RATE_LIMIT_WINDOW_MS", "60000"), 10),
  RATE_LIMIT_MAX: parseInt(optional("RATE_LIMIT_MAX", "100"), 10),
  REDIS_URL: optional("REDIS_URL", "redis://localhost:6379"),
  // Public app metadata (served to clients via GET /api/v1/config)
  CONTACT_EMAIL: optional("CONTACT_EMAIL", "pratik@example.com"),
  WHATSAPP_NUMBER: optional("WHATSAPP_NUMBER", "+919369319401"),
  PLAY_STORE_URL: optional("PLAY_STORE_URL", "https://play.google.com/store/apps/details?id=com.pathsharer"),
} as const;
