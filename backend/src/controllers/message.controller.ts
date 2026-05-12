import { NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { Types } from "mongoose";
import { Message } from "../models/message.model";

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 100;

/** GET /api/v1/messages/conversations */
export async function getConversations(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = new Types.ObjectId(req.userId!);

    const conversations = await Message.aggregate([
      // All messages involving current user
      { $match: { $or: [{ sender: userId }, { receiver: userId }] } },
      // Tag the "other" participant
      {
        $addFields: {
          otherUser: {
            $cond: [{ $eq: ["$sender", userId] }, "$receiver", "$sender"],
          },
        },
      },
      // Sort newest first so $first in $group picks the latest
      { $sort: { createdAt: -1 } },
      // Group by the other participant
      {
        $group: {
          _id: "$otherUser",
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$read", false] }, { $eq: ["$receiver", userId] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      // Fetch user details
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      // Sort conversations by latest message date
      { $sort: { "lastMessage.createdAt": -1 } },
      {
        $project: {
          _id: 0,
          userId: { $toString: "$_id" },
          name: "$user.name",
          unreadCount: 1,
          lastMessage: {
            type: "$lastMessage.type",
            content: "$lastMessage.content",
            imageUrl: "$lastMessage.imageUrl",
            createdAt: "$lastMessage.createdAt",
            isMine: { $eq: ["$lastMessage.sender", userId] },
          },
        },
      },
    ]);

    res.json({ conversations });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/messages/:otherUserId?before=<ISO date>&limit=<n> */
export async function getConversation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const otherUserId = req.params.otherUserId as string;
    const { before, limit: limitParam } = req.query;
    const limit = Math.min(
      Number.isFinite(Number(limitParam)) && Number(limitParam) > 0
        ? Number(limitParam)
        : DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    );

    if (!Types.ObjectId.isValid(otherUserId)) {
      res.status(400).json({ error: "Invalid otherUserId" });
      return;
    }

    const filter: Record<string, unknown> = {
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId },
      ],
    };

    if (before && typeof before === "string") {
      const beforeDate = new Date(before);
      if (isNaN(beforeDate.getTime())) {
        res.status(400).json({ error: "Invalid before date" });
        return;
      }
      filter.createdAt = { $lt: beforeDate };
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("sender", "name")
      .populate("receiver", "name")
      .lean();

    res.json({ messages: messages.reverse(), pageSize: limit });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/messages/image */
export async function deleteMessageImage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { filename } = req.body as { filename?: unknown };

    // Only allow safe filenames — no path traversal
    if (
      !filename ||
      typeof filename !== "string" ||
      !/^[a-zA-Z0-9_\-.]+$/.test(filename)
    ) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }

    const filePath = path.join(__dirname, "../../uploads", filename);
    await fs.promises.unlink(filePath).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== "ENOENT") throw err; // ignore already-deleted
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
export async function uploadMessageImage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No image file provided" });
      return;
    }

    const protocol = req.protocol;
    const host = req.get("host") ?? "localhost";
    const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    res.status(201).json({ imageUrl });
  } catch (err) {
    next(err);
  }
}
