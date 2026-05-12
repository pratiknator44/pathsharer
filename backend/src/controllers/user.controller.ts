import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { ActiveUser } from "../models/activeUser.model";
import { Message } from "../models/message.model";
import { User } from "../models/user.model";
import { generateJWT } from "../services/auth.service";
import { updateJourneyMetadataSchema } from "../validators/activeUser.validator";
import {
    createUserSchema,
    LocationSchema,
    updateUserSchema,
} from "../validators/user.validator";

export async function createUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = createUserSchema.parse(req.body);
    const user = await User.create(body);
    const token = generateJWT(String(user._id));
    res.status(201).json({ data: user, token });
  } catch (err) {
    next(err);
  }
}

export async function getUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    const user = await User.findById(id).lean();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    const body = updateUserSchema.parse(req.body);
    const user = await User.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    }).lean();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function updateLastLoggedIn(userId: string): Promise<void> {
  if (Types.ObjectId.isValid(userId)) {
    await User.updateOne(
      { _id: userId },
      { $set: { lastLoggedInAt: new Date() } }
    );
  }
}

export async function updateJourneyMetadata(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = updateJourneyMetadataSchema.parse(req.body);
    
    const metadata = await ActiveUser.findOneAndUpdate(
      { userId: new Types.ObjectId(body.userId) },
      {
        $set: {
          isActive: body.isActive,
          source: body.source,
          destination: body.destination,
          timestamp: new Date(),
        },
      },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    res.json({ data: metadata });
  } catch (err) {
    next(err);
  }
}

export async function getUserByPhone(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { phone } = req.query;
    if (!phone || typeof phone !== "string") {
      res.status(400).json({ error: "Phone number is required" });
      return;
    }
    const user = await User.findOne({ phone }).lean();
    if (!user) {
      res.json({ data: null });
      return;
    }
    const token = generateJWT(String(user._id));
    res.json({ data: user, token });
  } catch (err) {
    next(err);
  }
}

export async function getRecentSearches(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const user = await User.findById(userId).select("recentSearches").lean();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ data: user.recentSearches });
  } catch (err) {
    next(err);
  }
}

export async function addRecentSearch(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const place = LocationSchema.parse(req.body);

    // Remove any existing entry with the same name (dedup), then prepend and cap at 5
    await User.updateOne(
      { _id: userId },
      { $pull: { recentSearches: { name: place.name } } }
    );
    await User.updateOne(
      { _id: userId },
      {
        $push: {
          recentSearches: {
            $each: [place],
            $position: 0,
            $slice: 5,
          },
        },
      }
    );

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/users/me — wipe all data for the authenticated user */
export async function deleteCurrentUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    // Delete all messages sent or received by the user
    await Message.deleteMany({
      $or: [{ sender: userId }, { receiver: userId }],
    });

    // Remove active-user record
    await ActiveUser.deleteMany({ userId });

    // Delete the user document itself
    await User.findByIdAndDelete(userId);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
