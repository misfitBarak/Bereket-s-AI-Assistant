/**
 * Abbay AI Command Center — Single-User Authentication & Session Management
 *
 * Built with native Web Crypto API for 100% compatibility across
 * Next.js Edge Middleware, Serverless Functions, and Node.js.
 */

export const SESSION_COOKIE_NAME = "abbay_auth_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Global authentication gate toggle.
 * When false (default), login screens and session checks are bypassed across the app (dashboard opens directly).
 * Can be explicitly re-enabled by setting AUTH_ENABLED="true" in environment variables.
 */
export function isAuthEnabled(): boolean {
  return process.env.AUTH_ENABLED === "true";
}

// Helper for Base64URL encoding/decoding without external dependencies
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = typeof atob === "function" ? atob(base64) : Buffer.from(base64, "binary").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Retrieves the required server-side password.
 * Fails closed if missing in production when authentication is enabled.
 */
export function getAppPassword(): string | null {
  if (!isAuthEnabled()) {
    return null;
  }
  const pwd = process.env.APP_PASSWORD;
  if (!pwd || pwd.trim().length === 0) {
    if (process.env.NODE_ENV === "production") {
      console.error("🔒 Security Alert: APP_PASSWORD is not configured in production. Failing closed.");
    }
    return null;
  }
  return pwd.trim();
}

/**
 * Constant-time password verification using SHA-256 and bitwise XOR
 * Prevents timing attacks based on length or early-character matching.
 */
export async function verifyPassword(inputPassword: string): Promise<boolean> {
  const appPassword = getAppPassword();
  if (!appPassword || !inputPassword) {
    return false;
  }

  const enc = new TextEncoder();
  const inputHash = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(inputPassword)));
  const expectedHash = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(appPassword)));

  if (inputHash.length !== expectedHash.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < inputHash.length; i++) {
    diff |= inputHash[i] ^ expectedHash[i];
  }
  return diff === 0;
}

/**
 * Retrieves the dedicated session signing secret (AUTH_SECRET).
 * In production: strictly requires process.env.AUTH_SECRET and fails closed if missing or empty when auth is enabled.
 * Never falls back to APP_PASSWORD in production.
 * In development/test: falls back to a development secret if unset.
 */
export function getAuthSecret(): string | null {
  const secret = process.env.AUTH_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }

  if (isProd && isAuthEnabled()) {
    console.error("🔒 Security Alert: AUTH_SECRET is not configured in production. Failing closed.");
    return null;
  }

  // Non-production fallback only
  return "abbay-dev-auth-secret-do-not-use-in-production";
}

/**
 * Derives an HMAC-SHA256 signing key exclusively from AUTH_SECRET.
 * Fails closed if AUTH_SECRET is missing or empty in production.
 */
async function getSigningKey(): Promise<CryptoKey | null> {
  const secret = getAuthSecret();
  if (!secret) return null;

  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(`abbay-session-v1:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

/**
 * Creates a tamper-resistant HMAC-signed session token valid for 30 days
 */
export async function createSessionToken(username = "abbay"): Promise<string | null> {
  const key = await getSigningKey();
  if (!key) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload: SessionPayload = {
    sub: username,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };

  const enc = new TextEncoder();
  const headerPart = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadPart = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const dataToSign = enc.encode(`${headerPart}.${payloadPart}`);

  const sigBuffer = await crypto.subtle.sign("HMAC", key, dataToSign);
  const sigPart = base64UrlEncode(new Uint8Array(sigBuffer));

  return `${headerPart}.${payloadPart}.${sigPart}`;
}

/**
 * Verifies the cryptographic signature and expiration of a session token
 */
export async function verifySessionToken(token: string | undefined | null): Promise<{ valid: boolean; user?: string; error?: string }> {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Missing token" };
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Malformed token format" };
  }

  const [headerPart, payloadPart, sigPart] = parts;
  const key = await getSigningKey();
  if (!key) {
    return { valid: false, error: "Authentication secret missing (fail closed)" };
  }

  const enc = new TextEncoder();
  const dataToVerify = enc.encode(`${headerPart}.${payloadPart}`);
  let sigBytes: Uint8Array;

  try {
    sigBytes = base64UrlDecode(sigPart);
  } catch {
    return { valid: false, error: "Invalid signature encoding" };
  }

  const isValidSignature = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes as unknown as BufferSource,
    dataToVerify as unknown as BufferSource
  );
  if (!isValidSignature) {
    return { valid: false, error: "Signature verification failed" };
  }

  let payload: SessionPayload;
  try {
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadPart));
    payload = JSON.parse(payloadJson);
  } catch {
    return { valid: false, error: "Invalid payload JSON" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) {
    return { valid: false, error: "Session expired" };
  }

  if (!payload.sub || typeof payload.sub !== "string") {
    return { valid: false, error: "Invalid subject" };
  }

  return { valid: true, user: payload.sub };
}

// In-memory rate limiting map for login attempts (locks after 5 failed attempts for 5 minutes)
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

export function checkLoginRateLimit(clientIp: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(clientIp);

  if (!entry) {
    return { allowed: true };
  }

  if (entry.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  if (now - entry.lockedUntil > 15 * 60 * 1000) {
    // Reset if window has elapsed
    loginAttempts.delete(clientIp);
  }

  return { allowed: true };
}

export function recordFailedLogin(clientIp: string) {
  const now = Date.now();
  const entry = loginAttempts.get(clientIp) || { count: 0, lockedUntil: 0 };
  entry.count += 1;

  if (entry.count >= 5) {
    entry.lockedUntil = now + 5 * 60 * 1000; // 5-minute lockout
  }

  loginAttempts.set(clientIp, entry);
}

export function resetFailedLogin(clientIp: string) {
  loginAttempts.delete(clientIp);
}

/**
 * Validates and sanitizes a post-login redirect path.
 * Permits only safe internal relative paths (e.g. "/analytics", "/tasks?status=done").
 * Rejects:
 * - null, undefined, non-strings, or empty strings
 * - Protocol-relative URLs (e.g. "//attacker.com", "///attacker.com")
 * - Backslash-based bypasses (e.g. "/\attacker.com", "\\attacker.com", "/foo\bar")
 * - Absolute URLs with schemes (e.g. "https://...", "http://...", "javascript:", "data:")
 * - URLs with control characters or whitespace
 * - Redirect loops (e.g. "/login")
 * Always falls back to "/" whenever the destination is unsafe.
 */
export function getSafeRedirectUrl(target: string | null | undefined): string {
  if (!target || typeof target !== "string") {
    return "/";
  }

  const trimmed = target.trim();
  if (!trimmed) {
    return "/";
  }

  // Must begin with a single "/" and NOT followed by another "/" or "\"
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return "/";
  }

  // Reject any backslashes anywhere in the target string (browser normalization defense)
  if (trimmed.includes("\\")) {
    return "/";
  }

  // Reject control characters and non-printable characters
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return "/";
  }

  try {
    const dummyOrigin = "https://abbay-command-center.internal";
    const parsed = new URL(trimmed, dummyOrigin);

    // Ensure the origin was not modified
    if (parsed.origin !== dummyOrigin) {
      return "/";
    }

    // Ensure protocol was not modified
    if (parsed.protocol !== "https:") {
      return "/";
    }

    // Prevent redirect loop back to /login
    if (parsed.pathname === "/login") {
      return "/";
    }

    // Return safe relative path with search params and hash
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return "/";
  }
}
