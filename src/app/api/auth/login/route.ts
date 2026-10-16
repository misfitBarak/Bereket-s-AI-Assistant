import { NextRequest, NextResponse } from "next/server";
import {
  verifyPassword,
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  checkLoginRateLimit,
  recordFailedLogin,
  resetFailedLogin,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const rateCheck = checkLoginRateLimit(ip);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many failed attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid request payload" }, { status: 400 });
    }

    const { password } = body;
    if (!password || typeof password !== "string") {
      return NextResponse.json({ success: false, error: "Password is required" }, { status: 400 });
    }

    const isMatch = await verifyPassword(password);

    if (!isMatch) {
      recordFailedLogin(ip);
      // Fixed latency delay to discourage brute force attempts
      await new Promise((r) => setTimeout(r, 400));
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    resetFailedLogin(ip);
    const token = await createSessionToken("abbay");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Authentication system misconfigured (fail closed)" },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: "Authentication successful",
      user: "abbay",
    });

    const isProduction = process.env.NODE_ENV === "production";

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error: any) {
    console.error("Login API error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
