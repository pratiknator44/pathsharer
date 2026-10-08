import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { redisClient } from "../database/redis";
import { ActiveUser } from "../models/activeUser.model";
import { User } from "../models/user.model";
import { upsertActiveUserSchema } from "../validators/activeUser.validator";
import nameGenerator from "../utils/name-generator";

const REDIS_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * POST /api/v1/active-users
 * Requires: Authorization: Bearer <token>
 * Body: { isActive, source, destination }
 *
 * Creates or updates the ActiveUser record for the authenticated user.
 * Also caches the location in Redis for fast real-time lookups.
 */
export async function upsertActiveUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId as string;

    if (!Types.ObjectId.isValid(userId)) {
      res.status(400).json({ error: "Invalid userId in token" });
      return;
    }

    const body = upsertActiveUserSchema.parse(req.body);
    const user = await User.findById(userId).select("name phone").lean();
    const isWebGuest = user?.phone && /^0{9}\d+$/.test(user.phone);
    const name = isWebGuest && user ? user.name : nameGenerator();
    const activeUser = await ActiveUser.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        $set: {
          name,
          timestamp: new Date(),
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true }
    ).lean();

    // Write to Redis (fire-and-forget — don't block the response)
    redisClient
      .setEx(
        `active-user:${userId}`,
        REDIS_TTL_SECONDS,
        JSON.stringify({
          userId,
          name,
          isActive: body.isActive,
          source: body.source,
          destination: body.destination,
          updatedAt: new Date().toISOString(),
        })
      )
      .catch((err) => console.error("[Redis] Failed to cache active user:", err));

    res.status(200).json({ data: activeUser });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/active-users/nearby?lng=...&lat=...
 * Requires: Authorization: Bearer <token>
 *
 * Retrieves active users nearby the given coordinates based on their source or destination.
 */
export async function getNearbyUsers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { srcLng, srcLat, dstLng, dstLat } = req.query;

    if (!srcLng || !srcLat || typeof srcLng !== "string" || typeof srcLat !== "string" || !dstLng || !dstLat || typeof dstLng !== "string" || typeof dstLat !== "string") {
      res.status(400).json({ error: "Missing or invalid lng/lat query parameters" });
      return;
    }

    const srcLngNum = parseFloat(srcLng);
    const srcLatNum = parseFloat(srcLat);
    const dstLngNum = parseFloat(dstLng);
    const dstLatNum = parseFloat(dstLat);

    if (isNaN(srcLngNum) || isNaN(srcLatNum) || isNaN(dstLngNum) || isNaN(dstLatNum)) {
      res.status(400).json({ error: "lng/lat must be valid numbers" });
      return;
    }

    const { findUsersByCoords } = await import("../services/findCoPassenger.service");
    const nearbyUsers = await findUsersByCoords(srcLngNum, srcLatNum, dstLngNum, dstLatNum);

    // Optionally exclude the current user from the results
    const filteredUsers = nearbyUsers.filter(u => String(u.userId) !== String(req.userId));

    res.status(200).json({ data: filteredUsers });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/active-users/me
 * Requires: Authorization: Bearer <token>
 *
 * Marks the user as inactive in MongoDB and removes their Redis entry
 * so they no longer appear in co-passenger searches.
 */
export async function deleteActiveUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId as string;

    await ActiveUser.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: { isActive: false } }
    ).lean();

    redisClient
      .del(`active-user:${userId}`)
      .catch((err) => console.error("[Redis] Failed to delete active user key:", err));

    res.status(200).json({ message: "Active user entry removed" });
  } catch (err) {
    next(err);
  }
}
