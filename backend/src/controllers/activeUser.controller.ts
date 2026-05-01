import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { redisClient } from "../database/redis";
import { ActiveUser } from "../models/activeUser.model";
import { upsertActiveUserSchema } from "../validators/activeUser.validator";

const REDIS_TTL_SECONDS = 60 * 60 * 24; // 24 hours

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

    const activeUser = await ActiveUser.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        $set: {
          isActive: body.isActive,
          source: body.source,
          destination: body.destination,
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
    const { lng, lat } = req.query;

    if (!lng || !lat || typeof lng !== "string" || typeof lat !== "string") {
      res.status(400).json({ error: "Missing or invalid lng/lat query parameters" });
      return;
    }

    const lngNum = parseFloat(lng);
    const latNum = parseFloat(lat);

    if (isNaN(lngNum) || isNaN(latNum)) {
      res.status(400).json({ error: "lng/lat must be valid numbers" });
      return;
    }

    const { findUsersByCoords } = await import("../services/findCoPassenger.service");
    const nearbyUsers = await findUsersByCoords(lngNum, latNum);

    // Optionally exclude the current user from the results
    const filteredUsers = nearbyUsers.filter(u => u.userId !== req.userId);

    res.status(200).json({ data: filteredUsers });
  } catch (err) {
    next(err);
  }
}
