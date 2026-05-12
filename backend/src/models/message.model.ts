import { Document, Schema, Types, model } from "mongoose";

export interface IMessage extends Document {
  _id: Types.ObjectId;
  sender: Types.ObjectId;
  receiver: Types.ObjectId;
  type: "text" | "image";
  content?: string;
  imageUrl?: string;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["text", "image"],
      required: true,
      default: "text",
    },
    content: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index for fetching a conversation between two users efficiently
MessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });

MessageSchema.pre("validate", function () {
  if (this.type === "text" && !this.content) {
    throw new Error("content is required for text messages");
  }
  if (this.type === "image" && !this.imageUrl) {
    throw new Error("imageUrl is required for image messages");
  }
});

export const Message = model<IMessage>("Message", MessageSchema);
