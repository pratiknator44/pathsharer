import mongoose, { Types } from "mongoose";
import { ILocation, Journey, JourneyStatus } from "../models/journey.model";
import { UserJourney } from "../models/userJourney.model";

const VALID_TRANSITIONS: Record<JourneyStatus, JourneyStatus[]> = {
  discovering: ["matched", "cancelled"],
  matched: ["booked", "cancelled"],
  booked: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

function canTransition(from: JourneyStatus, to: JourneyStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Creates a new Journey and first UserJourney in a single transaction.
 */
export async function createJourneyWithParticipant(opts: {
  userId: Types.ObjectId;
  source: ILocation;
  userSource: ILocation;
  userDestination: ILocation;
  distanceMeters: number;
}) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const [journey] = await Journey.create(
      [
        {
          participants: [opts.userId],
          source: opts.source,
          status: "discovering",
        },
      ],
      { session }
    );

    const [userJourney] = await UserJourney.create(
      [
        {
          journeyId: journey._id,
          userId: opts.userId,
          source: opts.userSource,
          destination: opts.userDestination,
          distanceMeters: opts.distanceMeters,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return { journey, userJourney };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Adds a user to an existing journey and creates their UserJourney in a transaction.
 */
export async function joinJourney(opts: {
  journeyId: Types.ObjectId;
  userId: Types.ObjectId;
  userSource: ILocation;
  userDestination: ILocation;
  distanceMeters: number;
}) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const journey = await Journey.findOneAndUpdate(
      { _id: opts.journeyId, status: "discovering" },
      { $addToSet: { participants: opts.userId } },
      { new: true, session }
    );

    if (!journey) {
      throw Object.assign(new Error("Journey not found or not open"), {
        statusCode: 404,
      });
    }

    // Sync participantCount
    journey.participantCount = journey.participants.length;
    await journey.save({ session });

    const [userJourney] = await UserJourney.create(
      [
        {
          journeyId: opts.journeyId,
          userId: opts.userId,
          source: opts.userSource,
          destination: opts.userDestination,
          distanceMeters: opts.distanceMeters,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return { journey, userJourney };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Books a journey — atomic status check + bookedBy assignment.
 */
export async function bookJourney(opts: {
  journeyId: Types.ObjectId;
  bookedBy: Types.ObjectId;
  totalCostMinor: number;
}) {
  const journey = await Journey.findOneAndUpdate(
    { _id: opts.journeyId, status: { $in: ["discovering", "matched"] } },
    {
      $set: {
        status: "booked",
        bookedBy: opts.bookedBy,
        bookedAt: new Date(),
        totalCostMinor: opts.totalCostMinor,
      },
    },
    { new: true }
  );

  if (!journey) {
    throw Object.assign(
      new Error("Journey not found or cannot be booked at this stage"),
      { statusCode: 409 }
    );
  }

  return journey;
}

/**
 * Transitions a journey to a new status with guardrail checks.
 */
export async function transitionJourneyStatus(
  journeyId: Types.ObjectId,
  toStatus: JourneyStatus
) {
  const journey = await Journey.findById(journeyId);
  if (!journey) {
    throw Object.assign(new Error("Journey not found"), { statusCode: 404 });
  }

  if (!canTransition(journey.status, toStatus)) {
    throw Object.assign(
      new Error(
        `Cannot transition from '${journey.status}' to '${toStatus}'`
      ),
      { statusCode: 409 }
    );
  }

  journey.status = toStatus;
  await journey.save();
  return journey;
}
