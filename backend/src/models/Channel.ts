import mongoose, { Schema, type InferSchemaType } from "mongoose";

const channelSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    type: {
      type: String,
      enum: ["TEXT", "VOICE"],
      required: true,
      default: "TEXT",
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

channelSchema.index({ members: 1, updatedAt: -1 });
channelSchema.index({ owner: 1 });

export type ChannelDocument = InferSchemaType<typeof channelSchema>;

export const Channel = mongoose.model("Channel", channelSchema);
