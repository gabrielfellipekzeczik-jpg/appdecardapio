import { createRemoteJWKSet, jwtVerify } from "jose";
import type { IncomingMessage } from "node:http";
import type { User } from "../db";
import * as db from "../db";
import { ENV } from "./env";
import { isTestMode } from "../testData";

type SupabaseJwtPayload = { sub: string; email?: string };

// Supabase JWKS endpoint — works with both legacy HS256 and current ECC P-256 keys.
const getJWKS = (() => {
  let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
  return () => {
    if (!jwks) {
      const baseUrl = (ENV.supabaseUrl || process.env.VITE_SUPABASE_URL)!.replace(/\/$/, "");
      jwks = createRemoteJWKSet(new URL(`${baseUrl}/auth/v1/.well-known/jwks.json`));
    }
    return jwks;
  };
})();

function getBearerToken(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice(7);
  }
  return undefined;
}

const verifiedEmailCache = new Map<string, number>();
export async function isSupabaseEmailConfirmed(req: IncomingMessage, expectedEmail: string): Promise<boolean> {
  if (isTestMode()) return true;
  const token = getBearerToken(req);
  if (!token) return false;
  const claims = await verifySupabaseJwt(token);
  const email = expectedEmail.trim().toLowerCase();
  if (!claims || claims.email?.toLowerCase() !== email) return false;
  const cacheKey = `${claims.sub}:${email}`;
  if ((verifiedEmailCache.get(cacheKey) ?? 0) > Date.now()) return true;
  const baseUrl = (ENV.supabaseUrl || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!baseUrl || !serviceKey) throw new Error("Supabase Auth service credentials are not configured.");
  const response = await fetch(`${baseUrl}/auth/v1/admin/users/${encodeURIComponent(claims.sub)}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!response.ok) throw new Error(`Supabase Auth confirmation check failed (${response.status}).`);
  const authUser = await response.json() as { email?: string; email_confirmed_at?: string | null };
  const verified = Boolean(authUser.email_confirmed_at && authUser.email?.toLowerCase() === email);
  if (verified) verifiedEmailCache.set(cacheKey, Date.now() + 120_000);
  return verified;
}

async function verifySupabaseJwt(token: string): Promise<SupabaseJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJWKS());
    const sub = payload.sub;
    const email = typeof payload.email === "string" ? payload.email : undefined;
    if (typeof sub !== "string") return null;
    return { sub, email };
  } catch (error) {
    console.warn("[Auth] Supabase JWT verification failed:", String(error));
    return null;
  }
}

export async function authenticateRequest(req: IncomingMessage): Promise<User> {
  const token = getBearerToken(req);
  if (!token) throw new Error("Missing bearer token");

  const claims = await verifySupabaseJwt(token);
  if (!claims) throw new Error("Invalid session token");

  let user = await db.getUserBySupabaseId(claims.sub);
  if (!user) {
    await db.upsertUser({ supabaseUserId: claims.sub, email: claims.email ?? null, lastSignedIn: new Date().toISOString() });
    user = await db.getUserBySupabaseId(claims.sub);
  } else {
    await db.upsertUser({ supabaseUserId: claims.sub, email: claims.email ?? null, lastSignedIn: new Date().toISOString() });
  }

  if (!user) throw new Error("User could not be synced");
  return user;
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email || !ENV.ownerEmail) return false;
  return email.toLowerCase() === ENV.ownerEmail;
}
