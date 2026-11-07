import { Router } from "express";
import type { Response } from "express";
import { Channel } from "../models/Channel.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  createChannelSchema,
  updateChannelSchema,
  channelIdSchema,
} from "../schemas/channel.js";

const router = Router();

router.use(requireAuth);

router.post(
  "/",
  validateRequest(createChannelSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const { name, topic, type, isPrivate } = res.locals.validated.body;

      const channel = await Channel.create({
        name,
        topic: topic ?? "",
        type: type ?? "TEXT",
        isPrivate: isPrivate ?? false,
        owner: userId,
        members: [userId],
      });

      res.status(201).json({ channel });
    } catch (error) {
      console.error("Channel creation failed:", error);
      res.status(500).json({ error: "Failed to create channel" });
    }
  },
);

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const channels = await Channel.find({
      $or: [{ isPrivate: false }, { owner: userId }, { members: userId }],
    }).sort({ updatedAt: -1 });

    res.json({ channels });
  } catch (error) {
    console.error("Channel listing failed:", error);
    res.status(500).json({ error: "Failed to retrieve channels" });
  }
});

router.get(
  "/:id",
  validateRequest(channelIdSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = res.locals.validated.params;
      const channel = await Channel.findById(id);

      if (!channel) {
        res.status(404).json({ error: "Channel not found" });
        return;
      }

      const isMember = channel.members.some(
        (member) => member.toString() === req.userId,
      );
      const isOwner = channel.owner.toString() === req.userId;

      if (channel.isPrivate && !isMember && !isOwner) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      res.json({ channel });
    } catch (error) {
      console.error("Channel retrieval failed:", error);
      res.status(500).json({ error: "Failed to retrieve channel" });
    }
  },
);

router.patch(
  "/:id",
  validateRequest(updateChannelSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = res.locals.validated.params;
      const updates = res.locals.validated.body;
      const channel = await Channel.findById(id);

      if (!channel) {
        res.status(404).json({ error: "Channel not found" });
        return;
      }

      if (channel.owner.toString() !== req.userId) {
        res.status(403).json({ error: "Only the channel owner can update it" });
        return;
      }

      Object.assign(channel, updates);
      await channel.save();

      res.json({ channel });
    } catch (error) {
      console.error("Channel update failed:", error);
      res.status(500).json({ error: "Failed to update channel" });
    }
  },
);

router.delete(
  "/:id",
  validateRequest(channelIdSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = res.locals.validated.params;
      const channel = await Channel.findById(id);

      if (!channel) {
        res.status(404).json({ error: "Channel not found" });
        return;
      }

      if (channel.owner.toString() !== req.userId) {
        res.status(403).json({ error: "Only the channel owner can delete it" });
        return;
      }

      await channel.deleteOne();
      res.json({ message: "Channel deleted successfully" });
    } catch (error) {
      console.error("Channel deletion failed:", error);
      res.status(500).json({ error: "Failed to delete channel" });
    }
  },
);

export default router;
