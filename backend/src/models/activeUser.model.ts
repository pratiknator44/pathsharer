import { Document, Schema, Types, model } from "mongoose";
import { ILocation, LocationSchema } from "./journey.model";

export interface IActiveUser extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name?: string;
  isActive: boolean;
  source: ILocation;
  destination: ILocation;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ActiveUserSchema = new Schema<IActiveUser>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: false,
      trim: true,
      default: ""
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    source: {
      type: LocationSchema,
      required: true,
    },
    destination: {
      type: LocationSchema,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for finding active users quickly
ActiveUserSchema.index({ isActive: 1, updatedAt: -1 });
// Index for recent activity
ActiveUserSchema.index({ timestamp: -1 });

export const ActiveUser = model<IActiveUser>("ActiveUser", ActiveUserSchema);
