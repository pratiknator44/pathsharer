import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { Notification } from "../models/notification.model";

const PAGE_SIZE = 20;

/** GET /api/v1/notifications?before=<ISO date> */
export async function getNotifications(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { before } = req.query;

    const filter: Record<string, unknown> = { recipient: userId };

    if (before && typeof before === "string") {
      const beforeDate = new Date(before);
      if (isNaN(beforeDate.getTime())) {
        res.status(400).json({ error: "Invalid before date" });
        return;
      }
      filter.createdAt = { $lt: beforeDate };
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE)
      .lean();

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      read: false,
    });

    res.json({ notifications, unreadCount, pageSize: PAGE_SIZE });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/v1/notifications/:id/read */
export async function markNotificationRead(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid notification id" });
      return;
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: userId },
      { read: true, readAt: new Date() },
      { new: true }
    ).lean();

    if (!notification) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.json({ notification });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/v1/notifications/read-all */
export async function markAllNotificationsRead(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const now = new Date();

    await Notification.updateMany(
      { recipient: userId, read: false },
      { read: true, readAt: now }
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/notifications/:id */
export async function deleteNotification(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid notification id" });
      return;
    }

    const result = await Notification.deleteOne({ _id: id, recipient: userId });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
