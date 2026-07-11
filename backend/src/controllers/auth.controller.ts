import { NextFunction, Request, Response } from "express";
import { User } from "../models/user.model";
import { generateJWT } from "../services/auth.service";

/**
 * POST /api/v1/auth/web-guest
 *
 * MVP bypass for the web client.
 * • Finds the lowest unused web-guest slot (user1, user2, …).
 * • Creates the guest user in the DB if it doesn't exist yet.
 * • Returns a short-lived JWT (24 h) so the web client can call all
 *   protected endpoints without going through phone-OTP.
 *
 * The guest record is intentionally minimal:
 *   name  → "user<N>"
 *   phone → "000000000<N>"   (placeholder, passes relaxed regex)
 *   email → undefined (blank)
 *   gender → "male" (default)
 */
export async function webGuestLogin(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Find the next free guest slot by scanning existing placeholder phones.
    // Phones are like "0000000001", "0000000002", …
    const existing = await User.find({
      phone: /^0{9}\d+$/,
    })
      .select("phone")
      .lean();

    // Extract the numeric suffix from each placeholder phone and find max.
    const usedNumbers = existing.map((u) => {
      const suffix = u.phone.replace(/^0+/, ""); // strip leading zeros
      return parseInt(suffix, 10) || 0;
    });

    const nextN = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;

    const paddedPhone = `000000000${nextN}`; // e.g. "0000000001"
    const guestName = `user${nextN}`;

    // Upsert: if somehow this slot already exists, just return it.
    let user = await User.findOne({ phone: paddedPhone }).lean();

    if (!user) {
      user = await User.create({
        name: guestName,
        phone: paddedPhone,
        gender: "male",
        // email intentionally omitted → blank
      });
    }

    // 24-hour token — short-lived for a web MVP session.
    const token = generateJWT(String(user._id), 1);

    res.status(200).json({
      data: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email ?? null,
        gender: user.gender,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
}
