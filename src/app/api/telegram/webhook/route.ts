import { NextRequest, NextResponse } from "next/server";
import { handleTelegramUpdate } from "@/lib/telegram/bot";

export async function POST(req: NextRequest) {
  try {
    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const result = await handleTelegramUpdate(body, secretHeader);

    if (result.status === "bad_secret") {
      return NextResponse.json({ error: "Unauthorized: Invalid secret token" }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      handled: result.handled,
      status: result.status,
      replyText: result.replyText,
    });
  } catch (error: any) {
    console.error("Telegram webhook error:", error);
    // Return 200 to Telegram so it doesn't get stuck in a retry loop on internal errors
    return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "online",
    endpoint: "/api/telegram/webhook",
    note: "Send Telegram updates via POST with X-Telegram-Bot-Api-Secret-Token",
  });
}
