import "dotenv/config";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer, type Server } from "node:http";
import app from "../src/app.js";
import { connectDatabase } from "../src/config/database.js";
import { User } from "../src/models/User.js";
import { RefreshSession } from "../src/models/RefreshSession.js";

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
let refreshCookie: string;

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

  await RefreshSession.deleteMany({
    user: {
      $in: await User.find({ $or: [{ username }, { email }] }).distinct("_id"),
    },
  });

  await User.deleteMany({
    $or: [{ username }, { email }],
  });

  await mongoose.disconnect();
});

async function request(
  path: string,
  body?: unknown,
  token?: string,
  cookie?: string,
) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
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

  const cookies = response.headers.getSetCookie();
  const refreshSetCookie = cookies.find((value) =>
    value.startsWith("canvascord_refresh="),
  );
  assert.ok(refreshSetCookie);
  assert.match(refreshSetCookie, /HttpOnly/i);
  assert.match(refreshSetCookie, /SameSite=Lax/i);
  refreshCookie = refreshSetCookie.split(";")[0];

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

test("registration and login reject invalid fields with validation details", async () => {
  const invalidRegistration = await request("/api/auth/register", {
    username: "ab",
    email: "not-an-email",
    password: "short",
  });

  assert.equal(invalidRegistration.status, 400);

  const registrationData = await invalidRegistration.json();
  assert.equal(registrationData.error, "Validation failed");
  assert.ok(Array.isArray(registrationData.details));
  assert.ok(
    registrationData.details.some(
      (issue: { path: string }) => issue.path === "body.username",
    ),
  );
  assert.ok(
    registrationData.details.some(
      (issue: { path: string }) => issue.path === "body.email",
    ),
  );
  assert.ok(
    registrationData.details.some(
      (issue: { path: string }) => issue.path === "body.password",
    ),
  );

  const invalidLogin = await request("/api/auth/login", {
    identifier: "   ",
    password: "",
  });

  assert.equal(invalidLogin.status, 400);

  const loginData = await invalidLogin.json();
  assert.equal(loginData.error, "Validation failed");
  assert.ok(Array.isArray(loginData.details));
  assert.equal(loginData.details.length, 2);
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

test("refresh rotates the refresh token and rejects reuse", async () => {
  const firstCookie = refreshCookie;

  const response = await request(
    "/api/auth/refresh",
    undefined,
    undefined,
    firstCookie,
  );
  assert.equal(response.status, 200);

  const data = await response.json();
  assert.ok(data.token);
  accessToken = data.token;

  const cookies = response.headers.getSetCookie();
  const nextCookie = cookies
    .find((value) => value.startsWith("canvascord_refresh="))
    ?.split(";")[0];

  assert.ok(nextCookie);
  assert.notEqual(nextCookie, firstCookie);
  refreshCookie = nextCookie;

  const reused = await request(
    "/api/auth/refresh",
    undefined,
    undefined,
    firstCookie,
  );
  assert.equal(reused.status, 401);

  const concurrentResponses = await Promise.all([
    request("/api/auth/refresh", undefined, undefined, refreshCookie),
    request("/api/auth/refresh", undefined, undefined, refreshCookie),
  ]);

  assert.deepEqual(
    concurrentResponses.map((response) => response.status).sort(),
    [200, 401],
  );

  const successfulResponse = concurrentResponses.find(
    (response) => response.status === 200,
  );
  assert.ok(successfulResponse);

  const concurrentCookie = successfulResponse.headers
    .getSetCookie()
    .find((value) => value.startsWith("canvascord_refresh="))
    ?.split(";")[0];

  assert.ok(concurrentCookie);
  refreshCookie = concurrentCookie;
});

test("refresh rejects missing and invalid cookies", async () => {
  const missing = await request("/api/auth/refresh");
  assert.equal(missing.status, 401);

  const invalid = await request(
    "/api/auth/refresh",
    undefined,
    undefined,
    "canvascord_refresh=invalid",
  );
  assert.equal(invalid.status, 401);
});

test("logout revokes the refresh session", async () => {
  const session = await RefreshSession.findOne({
    user: (await User.findOne({ username }))?._id,
    revokedAt: null,
  });
  assert.ok(session);

  const response = await request(
    "/api/auth/logout",
    undefined,
    undefined,
    refreshCookie,
  );
  assert.equal(response.status, 200);
  assert.ok(
    response.headers
      .getSetCookie()
      .some((value) => value.startsWith("canvascord_refresh=;")),
  );

  const revoked = await RefreshSession.findById(session._id);
  assert.ok(revoked?.revokedAt);

  const refreshAfterLogout = await request(
    "/api/auth/refresh",
    undefined,
    undefined,
    refreshCookie,
  );
  assert.equal(refreshAfterLogout.status, 401);
});

test("protected endpoint rejects expired and invalid-signature tokens", async () => {
  const secret = process.env.JWT_ACCESS_SECRET;
  assert.ok(secret);

  const expiredToken = jwt.sign({}, secret, {
    subject: "507f1f77bcf86cd799439011",
    expiresIn: -1,
  });

  const invalidSignatureToken = jwt.sign(
    {},
    "wrong-secret-that-is-long-enough-for-testing",
    {
      subject: "507f1f77bcf86cd799439011",
      expiresIn: "15m",
    },
  );

  for (const token of [expiredToken, invalidSignatureToken]) {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 401);
  }
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
