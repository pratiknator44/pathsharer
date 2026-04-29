import { Document, Schema, Types, model } from "mongoose";

export type JourneyStatus =
  | "discovering"
  | "matched"
  | "booked"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface ILocation {
  name: string;
  coordinates: [number, number]; // [lng, lat]
}

export interface IJourney extends Document {
  _id: Types.ObjectId;
  participants: Types.ObjectId[];
  participantCount: number;
  source: ILocation;
  bookedBy?: Types.ObjectId | null;
  bookedAt?: Date | null;
  totalCostMinor: number; // stored in minor units (paise/cents)
  status: JourneyStatus;
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<ILocation>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (v: number[]) => {
          if (!Array.isArray(v) || v.length !== 2) return false;
          const [lng, lat] = v;
          return (
            typeof lng === "number" &&
            typeof lat === "number" &&
            lng >= -180 &&
            lng <= 180 &&
            lat >= -90 &&
            lat <= 90
          );
        },
        message: "coordinates must be [lng, lat] within valid geographic bounds",
      },
    },
  },
  { _id: false }
);

const JourneySchema = new Schema<IJourney>(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    participantCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    source: {
      type: LocationSchema,
      required: true,
    },
    bookedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    bookedAt: {
      type: Date,
      default: null,
    },
    totalCostMinor: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ["discovering", "matched", "booked", "in_progress", "completed", "cancelled"],
      default: "discovering",
    },
  },
  { timestamps: true }
);

// Deduplicate participants and sync participantCount before save
JourneySchema.pre("save", async function () {
  const seen = new Set<string>();
  this.participants = this.participants.filter((id) => {
    const key = id.toString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  this.participantCount = this.participants.length;
});

JourneySchema.index({ participants: 1 });
JourneySchema.index({ status: 1, createdAt: -1 });
JourneySchema.index({ bookedBy: 1, bookedAt: -1 });

export const Journey = model<IJourney>("Journey", JourneySchema);
export { LocationSchema };

