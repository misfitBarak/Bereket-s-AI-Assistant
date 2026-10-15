import { NextRequest, NextResponse } from "next/server";
import { executeDueScheduledMessages, listScheduledMessages } from "@/lib/services/schedulerService";

export async function POST(req: NextRequest) {
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
  try {
    const messages = await listScheduledMessages();
    return NextResponse.json({
      success: true,
      scheduledMessages: messages,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
