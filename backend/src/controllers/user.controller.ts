import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { ActiveUser } from "../models/activeUser.model";
import { User } from "../models/user.model";
import { updateJourneyMetadataSchema } from "../validators/activeUser.validator";
import {
    createUserSchema,
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
    res.status(201).json({ data: user });
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
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}
