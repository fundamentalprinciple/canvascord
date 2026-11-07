import { z } from "zod";

const channelFields = {
  name: z.string().trim().min(1).max(80),
  topic: z.string().trim().max(500).optional(),
  type: z.enum(["TEXT", "VOICE"]).optional(),
  isPrivate: z.boolean().optional(),
};

export const createChannelSchema = z.object({
  body: z.object(channelFields),
  params: z.object({}),
  query: z.object({}),
});

export const updateChannelSchema = z.object({
  body: z
    .object({
      name: channelFields.name.optional(),
      topic: channelFields.topic,
      type: channelFields.type,
      isPrivate: channelFields.isPrivate,
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
  params: z.object({
    id: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid channel ID"),
  }),
  query: z.object({}),
});

export const channelIdSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid channel ID"),
  }),
  query: z.object({}),
});
