import { Document, Schema, Types, model } from "mongoose";
import { ILocation, LocationSchema } from "./journey.model";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email?: string;
  phone: string;
  gender: "male" | "female";
  expoPushToken?: string;
  lastLoggedInAt?: Date;
  recentSearches: ILocation[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^\+?[1-9]\d{6,14}$/, "Phone must be in E.164 format"],
    },
    gender: {
      type: String,
      enum: ["male", "female"],
      required: true,
      default: "male",
    },
    lastLoggedInAt: {
      type: Date,
      default: null,
    },
    expoPushToken: {
      type: String,
      default: null,
      trim: true,
    },
    recentSearches: {
      type: [LocationSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const User = model<IUser>("User", UserSchema);
