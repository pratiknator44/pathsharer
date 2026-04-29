import { Types } from "mongoose";
import { Journey } from "../models/journey.model";
import { UserJourney } from "../models/userJourney.model";
import { bearingDegrees, bearingsAlign, isWithinRadius } from "../utils/geo";

const MATCH_RADIUS_METERS = 500; // sources must be within 500m
const BEARING_TOLERANCE_DEG = 45;

export interface MatchCandidate {
  journeyId: Types.ObjectId;
  participantCount: number;
  distanceMeters: number;
}

/**
 * Finds open journeys whose source is near the requester's source
 * and whose general direction aligns with the requester's destination.
 */
export async function findMatchingJourneys(
  userSource: [number, number],
  userDestination: [number, number],
  excludeUserId: Types.ObjectId
): Promise<MatchCandidate[]> {
  const userBearing = bearingDegrees(userSource, userDestination);

  const openJourneys = await Journey.find({
    status: "discovering",
    participants: { $ne: excludeUserId },
  })
    .select("_id source participantCount")
    .lean();

  const matches: MatchCandidate[] = [];

  for (const journey of openJourneys) {
    const journeySource = journey.source.coordinates as [number, number];

    if (!isWithinRadius(userSource, journeySource, MATCH_RADIUS_METERS)) {
      continue;
    }

    const journeyBearing = bearingDegrees(journeySource, userDestination);
    if (!bearingsAlign(userBearing, journeyBearing, BEARING_TOLERANCE_DEG)) {
      continue;
    }

    const distanceMeters = (
      await UserJourney.findOne({ journeyId: journey._id })
        .select("distanceMeters")
        .lean()
    )?.distanceMeters ?? 0;

    matches.push({
      journeyId: journey._id as Types.ObjectId,
      participantCount: journey.participantCount,
      distanceMeters,
    });
  }

  return matches;
}
