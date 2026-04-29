import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { Journey } from "../models/journey.model";
import {
    bookJourney,
    createJourneyWithParticipant,
    joinJourney,
    transitionJourneyStatus,
} from "../services/booking.service";
import { findMatchingJourneys } from "../services/matching.service";
import {
    bookJourneySchema,
    createJourneySchema,
    updateJourneyStatusSchema,
} from "../validators/journey.validator";

export async function createJourney(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = createJourneySchema.parse(req.body);

    // userSource/destination must be in req.body for initial route
    const { userSource, userDestination, distanceMeters } = req.body as {
      userSource: { name: string; coordinates: [number, number] };
      userDestination: { name: string; coordinates: [number, number] };
      distanceMeters: number;
    };

    const result = await createJourneyWithParticipant({
      userId: new Types.ObjectId(body.userId),
      source: body.source,
      userSource,
      userDestination,
      distanceMeters: distanceMeters ?? 0,
    });

    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function getOpenJourneys(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const journeys = await Journey.find({ status: "discovering" })
      .select("-__v")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ data: journeys });
  } catch (err) {
    next(err);
  }
}

export async function getJourney(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid journey id" });
      return;
    }
    const journey = await Journey.findById(id)
      .populate("participants", "name phone")
      .populate("bookedBy", "name phone")
      .lean();
    if (!journey) {
      res.status(404).json({ error: "Journey not found" });
      return;
    }
    res.json({ data: journey });
  } catch (err) {
    next(err);
  }
}

export async function joinExistingJourney(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid journey id" });
      return;
    }
    const { userId, userSource, userDestination, distanceMeters } =
      req.body as {
        userId: string;
        userSource: { name: string; coordinates: [number, number] };
        userDestination: { name: string; coordinates: [number, number] };
        distanceMeters: number;
      };

    const result = await joinJourney({
      journeyId: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      userSource,
      userDestination,
      distanceMeters: distanceMeters ?? 0,
    });

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function bookExistingJourney(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid journey id" });
      return;
    }
    const body = bookJourneySchema.parse(req.body);
    const journey = await bookJourney({
      journeyId: new Types.ObjectId(id),
      bookedBy: new Types.ObjectId(body.bookedBy),
      totalCostMinor: body.totalCostMinor,
    });
    res.json({ data: journey });
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid journey id" });
      return;
    }
    const body = updateJourneyStatusSchema.parse(req.body);
    const journey = await transitionJourneyStatus(
      new Types.ObjectId(id),
      body.status
    );
    res.json({ data: journey });
  } catch (err) {
    next(err);
  }
}

export async function getNearbyMatches(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId, source, destination } = req.body as {
      userId: string;
      source: [number, number];
      destination: [number, number];
    };
    const matches = await findMatchingJourneys(
      source,
      destination,
      new Types.ObjectId(userId)
    );
    res.json({ data: matches });
  } catch (err) {
    next(err);
  }
}
