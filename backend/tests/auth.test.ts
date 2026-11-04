import "dotenv/config";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createServer, type Server } from "node:http";
import app from "../src/app.js";
import { connectDatabase } from "../src/config/database.js";
import { User } from "../src/models/User.js";

const testUri = process.env.MONGODB_TEST_URI;

if (!testUri) {
  throw new Error("MONGODB_TEST_URI must point to a dedicated test database");
}

process.env.MONGODB_URI = testUri;

const username = `auth_test_${Date.now()}`;
const email = `${username}@example.com`;
const password = "CanvasCord_Test_123!";

let server: Server;
let baseUrl: string;
let accessToken: string;

before(async () => {
  await connectDatabase();

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
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  await User.deleteMany({
    $or: [{ username }, { email }],
  });

  await mongoose.disconnect();
});

async function request(path: string, body?: unknown, token?: string) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("registration creates a user and returns an access token", async () => {
  const response = await request("/api/auth/register", {
    username,
    email,
    password,
  });

  assert.equal(response.status, 201);

  const data = await response.json();
  assert.equal(data.user.username, username);
  assert.equal(data.user.email, email);
  assert.ok(data.token);

  accessToken = data.token;

  const user = await User.findOne({ username }).select("+passwordHash");
  assert.ok(user);
  assert.notEqual(user.passwordHash, password);
});

test("duplicate username or email is rejected", async () => {
  const duplicateUsername = await request("/api/auth/register", {
    username,
    email: `other_${email}`,
    password,
  });

  assert.equal(duplicateUsername.status, 409);

  const duplicateEmail = await request("/api/auth/register", {
    username: `${username}_other`,
    email,
    password,
  });

  assert.equal(duplicateEmail.status, 409);
});

test("invalid credentials are rejected", async () => {
  const response = await request("/api/auth/login", {
    identifier: username,
    password: "WrongPassword_123!",
  });

  assert.equal(response.status, 401);
});

test("login accepts username and email", async () => {
  for (const identifier of [username, email]) {
    const response = await request("/api/auth/login", {
      identifier,
      password,
    });

    assert.equal(response.status, 200);
    assert.ok((await response.json()).token);
  }
});

test("malformed and missing request bodies are rejected", async () => {
  const missing = await request("/api/auth/register");
  assert.equal(missing.status, 400);

  const malformed = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{invalid-json",
  });

  assert.equal(malformed.status, 400);
});

test("protected profile endpoint requires and accepts authentication", async () => {
  const unauthorized = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(unauthorized.status, 401);

  const authorized = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  assert.equal(authorized.status, 200);
  const data = await authorized.json();
  assert.equal(data.user.username, username);
});
