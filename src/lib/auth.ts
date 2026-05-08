import "./db/migrate";

import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/lib/db/client";
import { APIError, createAuthMiddleware } from "better-auth/api";

const authBaseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3001";

export const auth = betterAuth({
  appName: "AI Content Studio",
  database: db,
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me-before-production",
  baseURL: authBaseURL,
  trustedOrigins: [
    authBaseURL,
    "http://localhost:3000",
    "http://localhost:3001",
  ],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  plugins: [nextCookies()],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (process.env.ALLOW_REGISTRATION == "true") {
        return;
      }

      if (ctx.path === "/sign-up/email") {
        throw new APIError("FORBIDDEN", {
          message: "Registration is disabled",
        });
      }
    }),
  },
});
