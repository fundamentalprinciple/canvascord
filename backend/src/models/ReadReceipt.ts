import mongoose, { Schema, type InferSchemaType } from "mongoose";

const readReceiptSchema = new Schema(
  {
    channel: {
      type: Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastReadMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

readReceiptSchema.index({ channel: 1, user: 1 }, { unique: true });
readReceiptSchema.index({ user: 1, readAt: -1 });

export type ReadReceiptDocument = InferSchemaType<typeof readReceiptSchema>;

export const ReadReceipt = mongoose.model("ReadReceipt", readReceiptSchema);
