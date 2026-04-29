import { Types } from "mongoose";
import { Journey } from "../models/journey.model";
import { UserJourney } from "../models/userJourney.model";
import { splitCostEvenly } from "../utils/cost";

export interface CostSplit {
  userId: Types.ObjectId;
  costMinor: number;
}

/**
 * Distributes totalCostMinor evenly among all participants of a journey
 * and persists each user's share to their UserJourney document.
 * Returns the per-user splits.
 */
export async function distributeJourneyCost(
  journeyId: Types.ObjectId,
  totalCostMinor: number
): Promise<CostSplit[]> {
  const userJourneys = await UserJourney.find({ journeyId })
    .select("userId")
    .lean();

  if (userJourneys.length === 0) return [];

  const shares = splitCostEvenly(totalCostMinor, userJourneys.length);

  const splits: CostSplit[] = userJourneys.map((uj, i) => ({
    userId: uj.userId as Types.ObjectId,
    costMinor: shares[i],
  }));

  await Promise.all(
    splits.map(({ userId, costMinor }) =>
      UserJourney.updateOne({ journeyId, userId }, { $set: { costMinor } })
    )
  );

  await Journey.updateOne({ _id: journeyId }, { $set: { totalCostMinor } });

  return splits;
}
