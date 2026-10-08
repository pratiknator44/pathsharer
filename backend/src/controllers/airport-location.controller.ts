import { NextFunction, Request, Response } from "express";
import Expo from "expo-server-sdk";
import { Types } from "mongoose";
import { User } from "../models/user.model";
import { Notification } from "../models/notification.model";
import { notify } from "../services/push-notification.service";
import { sendWebPushNotification } from "../services/web-push.service";
import { findAirportNear } from "../utils/airport-utils";
import { airportLocationSchema } from "../validators/airport-location.validator";

const REMINDER_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** POST /api/v1/notifications/airport-location */
export async function notifyAtAirport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = airportLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "userId, lat, and lng must be valid" });
      return;
    }

    const userId = parsed.data.userId;
    if (!Types.ObjectId.isValid(userId)) {
      res.status(400).json({ error: "Invalid userId" });
      return;
    }

    const airport = findAirportNear(parsed.data.lat, parsed.data.lng);
    if (!airport) {
      res.json({ nearby: false });
      return;
    }

    if (parsed.data.expoPushToken && !Expo.isExpoPushToken(parsed.data.expoPushToken)) {
      res.status(400).json({ error: "Invalid Expo push token" });
      return;
    }

    const user = await User.findById(userId).select("expoPushToken");
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (parsed.data.expoPushToken && parsed.data.expoPushToken !== user.expoPushToken) {
      user.expoPushToken = parsed.data.expoPushToken;
      await user.save();
    }

    const cooldownStart = new Date(Date.now() - REMINDER_COOLDOWN_MS);
    const recentlyNotified = await Notification.exists({
      recipient: userId,
      type: "system",
      "data.kind": "airport-reminder",
      "data.airportCode": airport.code,
      createdAt: { $gte: cooldownStart },
    });

    if (recentlyNotified) {
      res.json({ nearby: true, airport: { code: airport.code, city: airport.city }, notificationQueued: false });
      return;
    }

    const body = `Traveling to ${airport.city}? Tap to find copassengers now`;
    const notificationData = {
      kind: "airport-reminder",
      airportCode: airport.code,
      city: airport.city,
      action: "find-copassengers",
      url: "/",
    };

    await notify(userId, {
      type: "system",
      title: "Airport reminder",
      body,
      data: notificationData,
      expoPushToken: user.expoPushToken,
    });
    await sendWebPushNotification(userId, {
      title: "Airport reminder",
      body,
      data: notificationData,
    });

    res.json({
      nearby: true,
      airport: { code: airport.code, city: airport.city },
      notificationQueued: true,
      pushTokenRegistered: Boolean(user.expoPushToken),
    });
  } catch (err) {
    next(err);
  }
}