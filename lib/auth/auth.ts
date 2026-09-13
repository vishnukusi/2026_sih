/**
 * Authentication & Session Management Subsystem
 *
 * Cryptographic scrypt password hashing, timing-safe verification,
 * HMAC-SHA256 stateless session tokens, and secure HTTP-only cookies.
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import type { SessionClaims, UserDocument } from "../../types";

export const SESSION_COOKIE_NAME = "oil_session";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

let devSecretFallback: string | null = null;

/**
 * Resolves the HMAC secret for signing and verifying session tokens.
 * In production, fails securely if SESSION_SECRET is unset or under 16 chars.
 */
export function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET;
  if (envSecret && envSecret.trim().length >= 16) {
    return envSecret.trim();
  }

  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    throw new Error(
      "[Security Error] SESSION_SECRET environment variable is not defined or is too short. In production/server environments, SESSION_SECRET must be explicitly configured via environment variables (minimum 16 characters)."
    );
  }

  if (!devSecretFallback) {
    devSecretFallback = crypto.randomBytes(32).toString("hex");
  }
  return devSecretFallback;
}

/**
 * Hashes a plaintext password using scrypt with a cryptographic salt.
 * Format: scrypt:<salt_hex>:<derived_key_hex>
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derivedKey}`;
}

/**
 * Verifies a password against a stored hash (or legacy plaintext password).
 */
export function verifyPassword(
  password: string,
  stored: string
): { valid: boolean; needsMigration: boolean } {
  if (!stored) return { valid: false, needsMigration: false };

  if (stored.startsWith("scrypt:")) {
    const parts = stored.split(":");
    if (parts.length !== 3) {
      return { valid: false, needsMigration: false };
    }
    const [, salt, expectedHex] = parts;
    const keyBuffer = crypto.scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expectedHex, "hex");

    if (keyBuffer.length !== expectedBuffer.length) {
      return { valid: false, needsMigration: false };
    }

    const match = crypto.timingSafeEqual(keyBuffer, expectedBuffer);
    return { valid: match, needsMigration: false };
  }

  const inputBuf = Buffer.from(password);
  const storedBuf = Buffer.from(stored);
  const valid =
    inputBuf.length === storedBuf.length && crypto.timingSafeEqual(inputBuf, storedBuf);

  return { valid, needsMigration: valid };
}

/**
 * Creates a signed stateless session token.
 */
export function createSessionToken(claims: {
  userId: string;
  role: "worker" | "manager";
}): string {
  const now = Date.now();
  const payload: SessionClaims = {
    userId: claims.userId,
    role: claims.role,
    issuedAt: now,
    expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = getSessionSecret();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies and decodes a signed session token.
 */
export function verifySessionToken(token: string): SessionClaims | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;

  const secret = getSessionSecret();
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload: SessionClaims = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8")
    );
    if (!payload.userId || !payload.role || !payload.expiresAt) {
      return null;
    }
    if (Date.now() > payload.expiresAt) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts session token from request Authorization or Cookie header.
 */
export function getSessionTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      return cookie.substring(SESSION_COOKIE_NAME.length + 1);
    }
  }
  return null;
}

/**
 * Resolves the authenticated user from the request session cookie.
 */
export async function getSessionUser(req: Request): Promise<UserDocument | null> {
  const token = getSessionTokenFromRequest(req);
  if (!token) return null;

  const claims = verifySessionToken(token);
  if (!claims) return null;

  const { getUserByEmail } = await import("@/lib/data/users");
  const user = await getUserByEmail(claims.userId);
  if (!user || user.status !== "approved") {
    return null;
  }

  return user;
}

/**
 * Attaches the HTTP-only secure session cookie to a NextResponse.
 */
export function setSessionCookie(
  res: NextResponse,
  user: { email: string; role: "worker" | "manager" }
): void {
  const token = createSessionToken({
    userId: user.email,
    role: user.role,
  });

  const isProd = process.env.NODE_ENV === "production";
  const cookieFlags = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    isProd ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

  res.headers.append("Set-Cookie", cookieFlags);
}

/**
 * Clears the session cookie on logout.
 */
export function clearSessionCookie(res: NextResponse): void {
  const isProd = process.env.NODE_ENV === "production";
  const cookieFlags = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    isProd ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

  res.headers.append("Set-Cookie", cookieFlags);
}
