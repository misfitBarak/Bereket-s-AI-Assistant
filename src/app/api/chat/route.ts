import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processUserMessage } from "@/lib/ai/engine";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId") || "default";

    const messages = await db.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    const formattedMessages = messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : null,
      toolResults: m.toolResults ? JSON.parse(m.toolResults) : null,
      pendingConfirmation: m.pendingConfirmation ? JSON.parse(m.pendingConfirmation) : null,
      createdAt: m.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, messages: formattedMessages });
  } catch (error: any) {
    console.error("GET /api/chat error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, conversationId = "default" } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
    }

    // 1. Store user message
    await db.chatMessage.create({
      data: {
        conversationId,
        role: "user",
        content: message.trim(),
      },
    });

    // 2. Process message through AI engine
    const aiResponse = await processUserMessage(message.trim(), conversationId);

    // 3. Store assistant message with tool results and any pending confirmation
    const savedAssistantMsg = await db.chatMessage.create({
      data: {
        conversationId,
        role: "assistant",
        content: aiResponse.content,
        toolCalls: aiResponse.toolCalls ? JSON.stringify(aiResponse.toolCalls) : null,
        toolResults: aiResponse.toolResults ? JSON.stringify(aiResponse.toolResults) : null,
        pendingConfirmation: aiResponse.pendingConfirmation
          ? JSON.stringify(aiResponse.pendingConfirmation)
          : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: {
        id: savedAssistantMsg.id,
        conversationId: savedAssistantMsg.conversationId,
        role: savedAssistantMsg.role,
        content: savedAssistantMsg.content,
        toolCalls: aiResponse.toolCalls || null,
        toolResults: aiResponse.toolResults || null,
        pendingConfirmation: aiResponse.pendingConfirmation || null,
        providerUsed: aiResponse.providerUsed,
        isDemoMode: aiResponse.isDemoMode,
        createdAt: savedAssistantMsg.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("POST /api/chat error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
