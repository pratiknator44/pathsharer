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
  NODE_ENV: (process.env.NODE_ENV || "development") as "development" | "production" | "test",
  PORT: 5000,
  MONGO_URI: "mongodb://127.0.0.1:27017/pathsharer",
  JWT_SECRET: "change_this_to_a_long_random_secret",
  RATE_LIMIT_WINDOW_MS: 60000,
  RATE_LIMIT_MAX: 100,
  REDIS_URL: "redis://localhost:6379",
  CONTACT_EMAIL: "pratik@example.com",
  WHATSAPP_NUMBER: "+919369319401",
  PLAY_STORE_URL: "https://play.google.com/store/apps/details?id=com.pathsharer",
  REFRESH_PASSENGER_INTERVAL_MS: 10000,
};
