import { z } from "zod";

const usernameSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_]{3,32}$/, {
    message: "Username must be 3–32 characters: letters, numbers, underscores",
  });

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email("A valid email is required");

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must not exceed 128 characters");

export const registerSchema = z.object({
  body: z.object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
  }),
  params: z.object({}),
  query: z.object({}),
});

export const loginSchema = z.object({
  body: z.object({
    identifier: z.string().trim().min(1, "Identifier is required"),
    password: z.string().min(1, "Password is required"),
  }),
  params: z.object({}),
  query: z.object({}),
});
