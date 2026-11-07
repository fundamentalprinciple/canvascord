import "dotenv/config";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { createServer, type Server } from "node:http";
import app from "../src/app.js";
import { connectDatabase } from "../src/config/database.js";
import { User } from "../src/models/User.js";
import { Channel } from "../src/models/Channel.js";
import { createAccessToken } from "../src/utils/authTokens.js";

const testUri = process.env.MONGODB_TEST_URI;

if (!testUri) {
  throw new Error("MONGODB_TEST_URI must point to a dedicated test database");
}

process.env.MONGODB_URI = testUri;

const suffix = Date.now();
let ownerId: string;
let otherId: string;
let ownerToken: string;
let otherToken: string;
let server: Server;
let baseUrl: string;

before(async () => {
  await connectDatabase();

  const passwordHash = await bcrypt.hash("Channel_Test_Password_123!", 12);

  const owner = await User.create({
    username: `channel_owner_${suffix}`,
    email: `channel_owner_${suffix}@example.com`,
    passwordHash,
  });

  const other = await User.create({
    username: `channel_other_${suffix}`,
    email: `channel_other_${suffix}@example.com`,
    passwordHash,
  });

  ownerId = owner.id;
  otherId = other.id;
  ownerToken = createAccessToken(ownerId);
  otherToken = createAccessToken(otherId);

  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine test server address");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await Channel.deleteMany({
    $or: [{ owner: ownerId }, { owner: otherId }],
  });

  await User.deleteMany({
    _id: { $in: [ownerId, otherId] },
  });

  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  await mongoose.disconnect();
});

async function request(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

test("channel CRUD, validation, and access control", async () => {
  const unauthorized = await request("GET", "/api/channels");
  assert.equal(unauthorized.status, 401);

  const invalid = await request("POST", "/api/channels", ownerToken, {
    name: "",
  });
  assert.equal(invalid.status, 400);

  const invalidId = await request("GET", "/api/channels/not-an-id", ownerToken);
  assert.equal(invalidId.status, 400);

  const publicResponse = await request("POST", "/api/channels", ownerToken, {
    name: "  General  ",
    topic: "  Community discussions  ",
    type: "TEXT",
  });

  assert.equal(publicResponse.status, 201);
  const publicData = await publicResponse.json();
  const publicChannel = publicData.channel;

  assert.equal(publicChannel.name, "General");
  assert.equal(publicChannel.topic, "Community discussions");
  assert.equal(publicChannel.isPrivate, false);
  assert.equal(publicChannel.owner, ownerId);

  const privateResponse = await request("POST", "/api/channels", ownerToken, {
    name: "Private room",
    type: "VOICE",
    isPrivate: true,
  });

  assert.equal(privateResponse.status, 201);
  const privateData = await privateResponse.json();
  const privateChannel = privateData.channel;

  assert.equal(privateChannel.isPrivate, true);
  assert.equal(privateChannel.type, "VOICE");

  const ownerList = await request("GET", "/api/channels", ownerToken);
  assert.equal(ownerList.status, 200);
  const ownerChannels = (await ownerList.json()).channels;
  assert.ok(
    ownerChannels.some(
      (channel: { _id: string }) => channel._id === publicChannel._id,
    ),
  );
  assert.ok(
    ownerChannels.some(
      (channel: { _id: string }) => channel._id === privateChannel._id,
    ),
  );

  const publicRead = await request(
    "GET",
    `/api/channels/${publicChannel._id}`,
    otherToken,
  );
  assert.equal(publicRead.status, 200);

  const privateRead = await request(
    "GET",
    `/api/channels/${privateChannel._id}`,
    otherToken,
  );
  assert.equal(privateRead.status, 403);

  const privateList = await request("GET", "/api/channels", otherToken);
  assert.equal(privateList.status, 200);
  const otherChannels = (await privateList.json()).channels;
  assert.ok(
    otherChannels.some(
      (channel: { _id: string }) => channel._id === publicChannel._id,
    ),
  );
  assert.ok(
    !otherChannels.some(
      (channel: { _id: string }) => channel._id === privateChannel._id,
    ),
  );

  const forbiddenUpdate = await request(
    "PATCH",
    `/api/channels/${publicChannel._id}`,
    otherToken,
    { name: "Hijacked" },
  );
  assert.equal(forbiddenUpdate.status, 403);

  const updated = await request(
    "PATCH",
    `/api/channels/${publicChannel._id}`,
    ownerToken,
    { name: "Announcements", topic: "Official updates" },
  );
  assert.equal(updated.status, 200);
  const updatedData = await updated.json();
  assert.equal(updatedData.channel.name, "Announcements");
  assert.equal(updatedData.channel.topic, "Official updates");

  const madePrivate = await request(
    "PATCH",
    `/api/channels/${publicChannel._id}`,
    ownerToken,
    { isPrivate: true },
  );
  assert.equal(madePrivate.status, 200);
  assert.equal((await madePrivate.json()).channel.isPrivate, true);

  const newlyPrivateRead = await request(
    "GET",
    `/api/channels/${publicChannel._id}`,
    otherToken,
  );
  assert.equal(newlyPrivateRead.status, 403);

  const newlyPrivateList = await request("GET", "/api/channels", otherToken);
  assert.equal(newlyPrivateList.status, 200);
  const channelsAfterPrivacyChange = (await newlyPrivateList.json()).channels;
  assert.ok(
    !channelsAfterPrivacyChange.some(
      (channel: { _id: string }) => channel._id === publicChannel._id,
    ),
  );

  const forbiddenDelete = await request(
    "DELETE",
    `/api/channels/${publicChannel._id}`,
    otherToken,
  );
  assert.equal(forbiddenDelete.status, 403);

  const deleted = await request(
    "DELETE",
    `/api/channels/${publicChannel._id}`,
    ownerToken,
  );
  assert.equal(deleted.status, 200);

  const missing = await request(
    "GET",
    `/api/channels/${publicChannel._id}`,
    ownerToken,
  );
  assert.equal(missing.status, 404);

  const deletedPrivate = await request(
    "DELETE",
    `/api/channels/${privateChannel._id}`,
    ownerToken,
  );
  assert.equal(deletedPrivate.status, 200);
});
