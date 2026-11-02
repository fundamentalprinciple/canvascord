import mongoose, { Schema, type InferSchemaType } from "mongoose";

const attachmentSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ["IMAGE", "FILE", "AUDIO"],
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      trim: true,
      maxlength: 255,
    },
    mimeType: {
      type: String,
      trim: true,
      maxlength: 127,
    },
    sizeBytes: {
      type: Number,
      min: 0,
    },
  },
  { _id: true },
);

const messageSchema = new Schema(
  {
    channel: {
      type: Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      trim: true,
      maxlength: 10000,
      default: "",
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    editedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

messageSchema.index({ channel: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });

export type MessageDocument = InferSchemaType<typeof messageSchema>;

export const Message = mongoose.model("Message", messageSchema);
