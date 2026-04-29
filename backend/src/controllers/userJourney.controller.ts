import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { UserJourney } from "../models/userJourney.model";
import {
    createUserJourneySchema,
    updateUserJourneySchema,
} from "../validators/userJourney.validator";

export async function createUserJourney(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = createUserJourneySchema.parse(req.body);
    const doc = await UserJourney.create(body);
    res.status(201).json({ data: doc });
  } catch (err) {
    next(err);
  }
}

export async function updateUserJourneyById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const body = updateUserJourneySchema.parse(req.body);
    const doc = await UserJourney.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    ).lean();
    if (!doc) {
      res.status(404).json({ error: "UserJourney not found" });
      return;
    }
    res.json({ data: doc });
  } catch (err) {
    next(err);
  }
}

export async function getUserJourneyHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string; // userId
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }

    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt((req.query.limit as string) ?? "20"), 50);

    const filter: Record<string, unknown> = { userId: new Types.ObjectId(id) };
    if (cursor && Types.ObjectId.isValid(cursor)) {
      filter._id = { $lt: new Types.ObjectId(cursor) };
    }

    const docs = await UserJourney.find(filter)
      .select("-__v")
      .sort({ _id: -1 })
      .limit(limit)
      .populate("journeyId", "status bookedAt totalCostMinor source")
      .lean();

    const nextCursor =
      docs.length === limit ? docs[docs.length - 1]._id.toString() : null;

    res.json({ data: docs, nextCursor });
  } catch (err) {
    next(err);
  }
}
