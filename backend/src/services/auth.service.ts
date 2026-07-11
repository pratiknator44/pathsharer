import jwt from "jsonwebtoken";
import { env } from "../config/env";

export function generateJWT(userId: string, expiryDays: number = 0): string {
  const options: jwt.SignOptions = expiryDays > 0
    ? { expiresIn: `${expiryDays}d` }
    : {};

  return jwt.sign({ userId }, env.JWT_SECRET, options);
}
