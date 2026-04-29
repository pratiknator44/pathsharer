import { Document, Schema, Types, model } from "mongoose";
import { ILocation, LocationSchema } from "./journey.model";

export interface IUserJourney extends Document {
  _id: Types.ObjectId;
  journeyId: Types.ObjectId;
  userId: Types.ObjectId;
  source: ILocation;
  destination: ILocation;
  distanceMeters: number;
  costMinor: number; // stored in minor units (paise/cents)
  createdAt: Date;
  updatedAt: Date;
}

const UserJourneySchema = new Schema<IUserJourney>(
  {
    journeyId: {
      type: Schema.Types.ObjectId,
      ref: "Journey",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    source: {
      type: LocationSchema,
      required: true,
    },
    destination: {
      type: LocationSchema,
      required: true,
    },
    distanceMeters: {
      type: Number,
      required: true,
      min: 0,
    },
    costMinor: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true }
);

// One user per journey in this collection
UserJourneySchema.index({ journeyId: 1, userId: 1 }, { unique: true });
// Fast user ride history
UserJourneySchema.index({ userId: 1, createdAt: -1 });
// Fast journey participant listing
UserJourneySchema.index({ journeyId: 1, createdAt: -1 });

export const UserJourney = model<IUserJourney>("UserJourney", UserJourneySchema);
