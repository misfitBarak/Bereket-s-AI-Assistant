import { NextRequest, NextResponse } from "next/server";
import { executeDueScheduledMessages, listScheduledMessages } from "@/lib/services/schedulerService";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (!cronSecret) {
    if (isProd) {
      console.error("🔒 Security Alert: CRON_SECRET is not configured in production. Failing closed.");
      return false; // Fail closed in production
    }
    return true; // Pass in local development only if no secret is configured
  }

  // Header-based authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await executeDueScheduledMessages();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    console.error("Scheduler tick error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // If explicit action=list requested, return list without ticking
    if (action === "list") {
      const messages = await listScheduledMessages();
      return NextResponse.json({
        success: true,
        scheduledMessages: messages,
      });
    }

    // Default for Vercel Cron (which invokes via GET): execute due messages
    const result = await executeDueScheduledMessages();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    console.error("Scheduler GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
