import jwt from "jsonwebtoken";

const PRIVATE_JWT_KEY = "kamehameha!@#";

export function generateJWT(userId: string, expiryDays: number = 0): string {
  const options: jwt.SignOptions = expiryDays > 0
    ? { expiresIn: `${expiryDays}d` }
    : {};

  return jwt.sign({ userId }, PRIVATE_JWT_KEY, options);
}
