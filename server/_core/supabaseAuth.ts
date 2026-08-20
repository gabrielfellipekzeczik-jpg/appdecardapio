import { jwtVerify } from "jose";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

type SupabaseJwtPayload = {
  sub: string;
  email?: string;
};

function getBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice(7);
  }
  return undefined;
}

async function verifySupabaseJwt(token: string): Promise<SupabaseJwtPayload | null> {
  if (!ENV.supabaseJwtSecret) {
    console.error("[Auth] SUPABASE_JWT_SECRET is not configured");
    return null;
  }
  try {
    const secretKey = new TextEncoder().encode(ENV.supabaseJwtSecret);
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
    const sub = payload.sub;
    const email = typeof payload.email === "string" ? payload.email : undefined;
    if (typeof sub !== "string") return null;
    return { sub, email };
  } catch (error) {
    console.warn("[Auth] Supabase JWT verification failed:", String(error));
    return null;
  }
}

/**
 * Resolves the authenticated app user from a Supabase-issued access token
 * (sent as `Authorization: Bearer <token>` by the client's Supabase session).
 * Syncs a local `users` row on first sight so admin/superAdmin role checks
 * can run without round-tripping to Supabase on every request.
 */
export async function authenticateRequest(req: Request): Promise<User> {
  const token = getBearerToken(req);
  if (!token) throw new Error("Missing bearer token");

  const claims = await verifySupabaseJwt(token);
  if (!claims) throw new Error("Invalid session token");

  let user = await db.getUserBySupabaseId(claims.sub);
  if (!user) {
    await db.upsertUser({
      supabaseUserId: claims.sub,
      email: claims.email ?? null,
      lastSignedIn: new Date(),
    });
    user = await db.getUserBySupabaseId(claims.sub);
  } else {
    await db.upsertUser({ supabaseUserId: claims.sub, lastSignedIn: new Date() });
  }

  if (!user) throw new Error("User could not be synced");
  return user;
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email || !ENV.ownerEmail) return false;
  return email.toLowerCase() === ENV.ownerEmail;
}
