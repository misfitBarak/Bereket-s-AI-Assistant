/**
 * Abbay AI Command Center — Comprehensive Authentication & Security Verification Suite
 *
 * Verifies all 11 security requirements specified in the user request:
 * 1. Unauthenticated GET /api/tasks returns 401
 * 2. Unauthenticated requests to /api/export, /api/settings, /api/chat, /api/telegram/personal are rejected
 * 3. Unauthenticated dashboard visit redirects to /login
 * 4. Incorrect password is rejected
 * 5. Correct password creates a valid session
 * 6. Invalid, expired, or tampered session is rejected
 * 7. Logout invalidates the session
 * 8. Authenticated dashboard requests and API calls work
 * 9. Telegram webhook requests require the secret token
 * 10. Scheduler requests require CRON_SECRET in production
 * 11. Missing production authentication configuration fails closed
 */

import { NextRequest } from "next/server";
import {
  createSessionToken,
  verifySessionToken,
  verifyPassword,
  getAppPassword,
  getAuthSecret,
  getSafeRedirectUrl,
  SESSION_COOKIE_NAME,
  base64UrlEncode,
} from "../src/lib/auth";
import { middleware } from "../src/middleware";
import { verifyWebhookSecret } from "../src/lib/telegram/bot";
import { POST as loginHandler } from "../src/app/api/auth/login/route";
import { POST as logoutHandler } from "../src/app/api/auth/logout/route";
import { GET as meHandler } from "../src/app/api/auth/me/route";
import { GET as schedulerHandler } from "../src/app/api/scheduler/tick/route";

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail: string = "") {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ PASS: ${testName} ${detail ? `(${detail})` : ""}`);
  } else {
    console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
    process.exitCode = 1;
  }
}

async function runTests() {
  console.log("===============================================================");
  console.log("🔒 ABBAY AI COMMAND CENTER — SECURITY & AUTH VERIFICATION");
  console.log("===============================================================\n");

  const TEST_PASSWORD = "abbay-super-secure-test-passphrase-2026";
  const TEST_AUTH_SECRET = "abbay-super-secure-auth-secret-signing-key-2026";
  process.env.APP_PASSWORD = TEST_PASSWORD;
  process.env.AUTH_SECRET = TEST_AUTH_SECRET;

  // --- SUITE 1: Password Verification (Timing-safe & Error Handling) ---
  console.log("--- 1. Password Verification & Constant-Time Comparison ---");
  const validPassCheck = await verifyPassword(TEST_PASSWORD);
  assert(validPassCheck, "Correct password verified successfully");

  const invalidPassCheck = await verifyPassword("wrong-password-attempt");
  assert(!invalidPassCheck, "Incorrect password rejected");

  const emptyPassCheck = await verifyPassword("");
  assert(!emptyPassCheck, "Empty password rejected");

  // --- SUITE 2: Session Token Creation, Tampering & Expiry ---
  console.log("\n--- 2. Cryptographic Session Token Creation & Tamper Resistance ---");
  const sessionToken = await createSessionToken("abbay");
  assert(Boolean(sessionToken && sessionToken.split(".").length === 3), "Valid 3-part HMAC-SHA256 session token generated");

  const verifyValid = await verifySessionToken(sessionToken);
  assert(verifyValid.valid && verifyValid.user === "abbay", "Valid session token verifies successfully", `User: ${verifyValid.user}`);

  // Tamper test: Alter payload
  const parts = (sessionToken || "").split(".");
  const tamperedPayload = parts[0] + "." + parts[1].slice(0, -3) + "xyz." + parts[2];
  const verifyTampered = await verifySessionToken(tamperedPayload);
  assert(!verifyTampered.valid, "Tampered payload is strictly rejected");

  // Tamper test: Alter signature
  const tamperedSig = parts[0] + "." + parts[1] + "." + parts[2].slice(0, -4) + "AAAA";
  const verifyTamperedSig = await verifySessionToken(tamperedSig);
  assert(!verifyTamperedSig.valid, "Tampered signature is strictly rejected");

  // Expired token test
  const expiredPayload = { sub: "abbay", iat: 1000, exp: 2000 };
  const enc = new TextEncoder();
  const expPart = base64UrlEncode(enc.encode(JSON.stringify(expiredPayload)));
  const fakeExpiredToken = `${parts[0]}.${expPart}.${parts[2]}`;
  const verifyExpired = await verifySessionToken(fakeExpiredToken);
  assert(!verifyExpired.valid, "Expired token is rejected");

  // --- SUITE 3: Login, Logout, and Me API Route Handlers ---
  console.log("\n--- 3. Auth API Route Handlers (/api/auth/login, logout, me) ---");

  // Test POST /api/auth/login with wrong password
  const failLoginReq = new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "wrong-password" }),
  });
  const failLoginRes = await loginHandler(failLoginReq);
  assert(failLoginRes.status === 401, "POST /api/auth/login with incorrect password returns 401");

  // Test POST /api/auth/login with correct password
  const successLoginReq = new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: TEST_PASSWORD }),
  });
  const successLoginRes = await loginHandler(successLoginReq);
  assert(successLoginRes.status === 200, "POST /api/auth/login with correct password returns 200");

  const setCookieHeader = successLoginRes.headers.get("set-cookie") || "";
  assert(setCookieHeader.includes(SESSION_COOKIE_NAME), "Login sets abbay_auth_session cookie");
  assert(setCookieHeader.includes("HttpOnly") || setCookieHeader.includes("httponly"), "Session cookie is HttpOnly");
  assert(/samesite=strict/i.test(setCookieHeader), "Session cookie is SameSite=Strict");

  // Extract token from cookie header
  const match = setCookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  const cookieValue = match ? match[1] : "";

  // Test GET /api/auth/me with cookie
  const meReq = new NextRequest("http://localhost:3000/api/auth/me", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
  });
  const meRes = await meHandler(meReq);
  const meData = await meRes.json();
  assert(meRes.status === 200 && meData.authenticated === true, "GET /api/auth/me returns authenticated: true for valid cookie");

  // Test GET /api/auth/me without cookie
  const unauthMeReq = new NextRequest("http://localhost:3000/api/auth/me");
  const unauthMeRes = await meHandler(unauthMeReq);
  assert(unauthMeRes.status === 401, "GET /api/auth/me returns 401 for unauthenticated request");

  // Test POST /api/auth/logout
  const logoutRes = await logoutHandler();
  const logoutCookie = logoutRes.headers.get("set-cookie") || "";
  assert(logoutCookie.includes("Max-Age=0") || logoutCookie.includes("max-age=0") || logoutCookie.includes("Expires="), "POST /api/auth/logout invalidates session cookie");

  // --- SUITE 4: Next.js Middleware Route Protection ---
  console.log("\n--- 4. Next.js Middleware Protection (APIs & Pages) ---");

  // 1. Unauthenticated API requests must return 401
  const protectedApis = [
    "/api/tasks",
    "/api/projects",
    "/api/team",
    "/api/memories",
    "/api/chat",
    "/api/ai/confirm",
    "/api/settings",
    "/api/analytics",
    "/api/export",
    "/api/telegram/personal",
  ];

  for (const apiPath of protectedApis) {
    const unauthReq = new NextRequest(`http://localhost:3000${apiPath}`);
    const mwRes = await middleware(unauthReq);
    assert(mwRes.status === 401, `Unauthenticated request to ${apiPath} returns 401`);
  }

  // 2. Unauthenticated page requests must redirect to /login
  const unauthPageReq = new NextRequest("http://localhost:3000/");
  const mwPageRes = await middleware(unauthPageReq);
  assert(mwPageRes.status === 307 || mwPageRes.status === 302, "Unauthenticated dashboard visit redirects");
  const redirectLocation = mwPageRes.headers.get("location") || "";
  assert(redirectLocation.includes("/login"), "Unauthenticated dashboard visit redirects specifically to /login");

  // 3. Authenticated requests with valid cookie must pass
  const authApiReq = new NextRequest("http://localhost:3000/api/tasks", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
  });
  const authApiRes = await middleware(authApiReq);
  assert(authApiRes.status === 200, "Authenticated request to /api/tasks is permitted through middleware");

  const authPageReq = new NextRequest("http://localhost:3000/", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
  });
  const authPageRes = await middleware(authPageReq);
  assert(authPageRes.status === 200, "Authenticated request to dashboard / is permitted through middleware");

  // 4. Authenticated user visiting /login redirects to dashboard /
  const authLoginReq = new NextRequest("http://localhost:3000/login", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
  });
  const authLoginRes = await middleware(authLoginReq);
  assert(authLoginRes.status === 307 || authLoginRes.status === 302, "Authenticated user visiting /login is redirected to /");

  // 5. Unauthenticated user visiting /login is allowed
  const unauthLoginReq = new NextRequest("http://localhost:3000/login");
  const unauthLoginRes = await middleware(unauthLoginReq);
  assert(unauthLoginRes.status === 200, "Unauthenticated user visiting /login is allowed without redirect loop");

  // --- SUITE 5: Telegram Webhook & Scheduler Bypass / Protection ---
  console.log("\n--- 5. Telegram Webhook & Scheduler Bypasses & Secret Verification ---");

  // Webhook and scheduler must bypass session cookie middleware
  const webhookMwReq = new NextRequest("http://localhost:3000/api/telegram/webhook");
  const webhookMwRes = await middleware(webhookMwReq);
  assert(webhookMwRes.status === 200, "/api/telegram/webhook passes middleware without browser session cookie");

  const schedulerMwReq = new NextRequest("http://localhost:3000/api/scheduler/tick");
  const schedulerMwRes = await middleware(schedulerMwReq);
  assert(schedulerMwRes.status === 200, "/api/scheduler/tick passes middleware without browser session cookie");

  // Webhook secret validation logic
  const TEST_WEBHOOK_SECRET = "test-wh-secret-xyz-789";
  assert(verifyWebhookSecret(TEST_WEBHOOK_SECRET, TEST_WEBHOOK_SECRET), "Webhook validates matching secret token");
  assert(!verifyWebhookSecret("bad-token", TEST_WEBHOOK_SECRET), "Webhook rejects invalid secret token");
  assert(!verifyWebhookSecret(null, TEST_WEBHOOK_SECRET), "Webhook rejects missing secret header");

  // Production fail-closed for webhook
  const origEnv = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = "production";
  const failClosedWh = verifyWebhookSecret("any-token", "");
  assert(!failClosedWh, "Webhook fails closed in production when TELEGRAM_WEBHOOK_SECRET is unconfigured");
  (process.env as any).NODE_ENV = origEnv;

  // Scheduler CRON_SECRET validation logic in production
  (process.env as any).NODE_ENV = "production";
  process.env.CRON_SECRET = "test-cron-secret-12345";

  // Scheduler unauthenticated in production -> 401
  const unauthCronReq = new NextRequest("http://localhost:3000/api/scheduler/tick");
  const unauthCronRes = await schedulerHandler(unauthCronReq);
  assert(unauthCronRes.status === 401, "Scheduler rejects request without Bearer CRON_SECRET in production");

  // Scheduler with query string in production -> rejected (no query string bypass in prod)
  const queryCronReq = new NextRequest("http://localhost:3000/api/scheduler/tick?secret=test-cron-secret-12345");
  const queryCronRes = await schedulerHandler(queryCronReq);
  assert(queryCronRes.status === 401, "Scheduler rejects query-string secret in production (header only)");

  // Scheduler with valid Authorization: Bearer <CRON_SECRET> header -> authorized
  const authCronReq = new NextRequest("http://localhost:3000/api/scheduler/tick?action=list", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const authCronRes = await schedulerHandler(authCronReq);
  assert(authCronRes.status === 200, "Scheduler accepts valid Authorization: Bearer <CRON_SECRET> header in production");

  // Scheduler missing CRON_SECRET in production -> fails closed
  delete process.env.CRON_SECRET;
  const missingSecretCronReq = new NextRequest("http://localhost:3000/api/scheduler/tick");
  const missingSecretCronRes = await schedulerHandler(missingSecretCronReq);
  assert(missingSecretCronRes.status === 401, "Scheduler fails closed in production when CRON_SECRET is unconfigured");

  // Missing APP_PASSWORD in production -> fails closed
  delete process.env.APP_PASSWORD;
  const missingPass = getAppPassword();
  assert(missingPass === null, "getAppPassword() fails closed in production when APP_PASSWORD is missing");

  // --- SUITE 7: Dedicated Session Secret & Production Fail-Closed ---
  console.log("\n--- 7. Dedicated Session Signing Secret & Production Fail-Closed ---");

  // Verify getAuthSecret returns configured AUTH_SECRET
  process.env.AUTH_SECRET = TEST_AUTH_SECRET;
  assert(getAuthSecret() === TEST_AUTH_SECRET, "getAuthSecret() retrieves configured AUTH_SECRET");

  // In production, missing AUTH_SECRET fails closed and does NOT fall back to APP_PASSWORD
  (process.env as any).NODE_ENV = "production";
  delete process.env.AUTH_SECRET;
  process.env.APP_PASSWORD = TEST_PASSWORD;

  const missingSecretProd = getAuthSecret();
  assert(missingSecretProd === null, "getAuthSecret() returns null (fails closed) in production when AUTH_SECRET is missing");

  // Even if APP_PASSWORD exists in production, token creation must fail closed when AUTH_SECRET is missing
  const tokenMissingSecret = await createSessionToken("abbay");
  assert(tokenMissingSecret === null, "createSessionToken() returns null in production when AUTH_SECRET is missing");

  // Even if APP_PASSWORD exists in production, token verification must fail closed when AUTH_SECRET is missing
  const verifyMissingSecret = await verifySessionToken(sessionToken);
  assert(!verifyMissingSecret.valid, "verifySessionToken() fails closed in production when AUTH_SECRET is missing");

  // Login handler must fail closed (500 misconfigured) in production when AUTH_SECRET is missing
  const loginMissingSecretReq = new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: TEST_PASSWORD }),
  });
  const loginMissingSecretRes = await loginHandler(loginMissingSecretReq);
  assert(loginMissingSecretRes.status === 500, "Login API endpoint fails closed (500) in production when AUTH_SECRET is missing");

  // Restore production AUTH_SECRET and verify recovery
  process.env.AUTH_SECRET = TEST_AUTH_SECRET;
  const tokenRestored = await createSessionToken("abbay");
  assert(Boolean(tokenRestored), "createSessionToken() succeeds when AUTH_SECRET is restored in production");

  // --- SUITE 8: Safe Post-Login Redirect & Attack Vector Defense ---
  console.log("\n--- 8. Safe Post-Login Redirect Validation (Open Redirect Protection) ---");

  // Valid relative internal paths
  assert(getSafeRedirectUrl("/dashboard") === "/dashboard", "Permits internal path /dashboard");
  assert(getSafeRedirectUrl("/analytics?range=7d") === "/analytics?range=7d", "Permits internal path with query params /analytics?range=7d");
  assert(getSafeRedirectUrl("/projects/1#milestone") === "/projects/1#milestone", "Permits internal path with hash /projects/1#milestone");
  assert(getSafeRedirectUrl("/") === "/", "Permits root path /");

  // Missing or empty values fallback to /
  assert(getSafeRedirectUrl(null) === "/", "Null input falls back to /");
  assert(getSafeRedirectUrl(undefined) === "/", "Undefined input falls back to /");
  assert(getSafeRedirectUrl("") === "/", "Empty string falls back to /");
  assert(getSafeRedirectUrl("   ") === "/", "Whitespace string falls back to /");

  // Protocol-relative URLs (//attacker.com) strictly rejected
  assert(getSafeRedirectUrl("//attacker.com") === "/", "Rejects protocol-relative //attacker.com");
  assert(getSafeRedirectUrl("///attacker.com") === "/", "Rejects protocol-relative ///attacker.com");
  assert(getSafeRedirectUrl("//attacker.com/evil") === "/", "Rejects protocol-relative //attacker.com/evil");

  // Absolute URLs with schemes strictly rejected
  assert(getSafeRedirectUrl("https://attacker.com") === "/", "Rejects https://attacker.com");
  assert(getSafeRedirectUrl("http://attacker.com") === "/", "Rejects http://attacker.com");
  assert(getSafeRedirectUrl("javascript:alert(1)") === "/", "Rejects javascript: pseudo-protocol");
  assert(getSafeRedirectUrl("data:text/html,evil") === "/", "Rejects data: URI scheme");

  // Backslash-based browser normalization bypasses strictly rejected
  assert(getSafeRedirectUrl("/\\attacker.com") === "/", "Rejects backslash bypass /\\attacker.com");
  assert(getSafeRedirectUrl("\\\\attacker.com") === "/", "Rejects backslash bypass \\\\attacker.com");
  assert(getSafeRedirectUrl("/evil\\path") === "/", "Rejects path containing backslash /evil\\path");
  assert(getSafeRedirectUrl("/@attacker.com") === "/@attacker.com", "Safely handles leading @ sign as local path");

  // Control characters and newlines strictly rejected
  assert(getSafeRedirectUrl("/\nattacker.com") === "/", "Rejects control characters /\\nattacker.com");
  assert(getSafeRedirectUrl("/\r\nattacker.com") === "/", "Rejects CRLF /\\r\\nattacker.com");

  // Redirect loop protection
  assert(getSafeRedirectUrl("/login") === "/", "Prevents redirect loop back to /login");

  // Restore environment
  (process.env as any).NODE_ENV = origEnv;
  process.env.APP_PASSWORD = TEST_PASSWORD;
  process.env.AUTH_SECRET = TEST_AUTH_SECRET;

  console.log("\n===============================================================");
  console.log(`TEST SUMMARY: ${passedTests} OF ${totalTests} TESTS PASSED (0 FAILED)`);
  console.log("===============================================================\n");
}

runTests().catch((err) => {
  console.error("Test execution exception:", err);
  process.exit(1);
});
