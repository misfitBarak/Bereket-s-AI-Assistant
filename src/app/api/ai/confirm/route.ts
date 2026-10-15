import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { confirmationId, messageId, approved, payload } = body;

    if (!payload) {
      return NextResponse.json({ success: false, error: "Missing confirmation payload" }, { status: 400 });
    }

    if (!approved) {
      // User rejected the action
      if (messageId) {
        await db.chatMessage.update({
          where: { id: messageId },
          data: { pendingConfirmation: null },
        });
      }
      return NextResponse.json({
        success: true,
        actionExecuted: false,
        message: "Action cancelled safely by user.",
      });
    }

    // Execute approved consequential action
    const { actionType, taskId, projectId } = payload;
    let resultMessage = "";

    if (actionType === "delete_task" && taskId) {
      const task = await db.task.findUnique({ where: { id: taskId } });
      if (task) {
        await db.task.delete({ where: { id: taskId } });
        await db.activityLog.create({
          data: {
            taskId: null,
            action: "deleted",
            details: `Confirmed deletion of task "${task.title}"`,
          },
        });
        resultMessage = `Task "${task.title}" was confirmed and permanently deleted.`;
      } else {
        resultMessage = "Task was already deleted or not found.";
      }
    } else if (actionType === "delete_project" && projectId) {
      const proj = await db.project.findUnique({ where: { id: projectId } });
      if (proj) {
        await db.project.delete({ where: { id: projectId } });
        resultMessage = `Project "${proj.title}" was confirmed and deleted.`;
      }
    } else if (actionType === "send_personal_telegram_message" && payload.peerId) {
      const { sendPersonalMessage } = await import("@/lib/telegram/personalClient");
      if (payload.expiresAt && payload.expiresAt < Date.now()) {
        return NextResponse.json(
          { success: false, error: "Confirmation expired (15-minute safeguard window). Please re-request your message." },
          { status: 400 }
        );
      }
      await sendPersonalMessage(payload.peerId, payload.messageText);
      resultMessage = `Message dispatched to "${payload.recipientName}" from your personal Telegram account.`;
    } else {
      resultMessage = "Approved action processed.";
    }

    // Clear pending confirmation on the chat message
    if (messageId) {
      await db.chatMessage.update({
        where: { id: messageId },
        data: {
          pendingConfirmation: null,
          content: `${resultMessage}\n\n*(Safely confirmed and executed)*`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      actionExecuted: true,
      message: resultMessage,
    });
  } catch (error: any) {
    console.error("POST /api/ai/confirm error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
