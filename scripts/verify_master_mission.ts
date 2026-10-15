import * as fs from "fs";
import * as path from "path";
import { db } from "../src/lib/db";
import {
  resolveScheduledTime,
  resolveRecipient,
  createScheduledMessage,
  listScheduledMessages,
  updateScheduledMessage,
  cancelScheduledMessage,
  generateReportContent,
  executeDueScheduledMessages,
  registerRecipient,
} from "../src/lib/services/schedulerService";
import { processUserMessage } from "../src/lib/ai/engine";
import { handleTelegramUpdate, getTelegramCredentials } from "../src/lib/telegram/bot";

async function runMasterVerification() {
  console.log("===============================================================");
  console.log("🚀 MASTER MISSION: VOICE ASSISTANT & SCHEDULED MESSAGING SUITE");
  console.log("   (Verifying persistent scheduling, voice routing, & recurrence)");
  console.log("===============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: any, testName: string, detail: string = "") {
    if (Boolean(condition)) {
      console.log(`✅ PASS: ${testName} ${detail ? `(${detail})` : ""}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
      failed++;
    }
  }

  const anchor = new Date("2026-10-14T12:00:00Z"); // Wednesday, Oct 14, 2026

  // -------------------------------------------------------------------------
  // TEST 1: Scheduled Time Parsing in Africa/Addis_Ababa Timezone (UTC+3)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 1: Natural Language Time Parsing in Africa/Addis_Ababa (UTC+3) ---");

  // 1a. Tomorrow at 5 PM (17:00 EAT = 14:00 UTC)
  const resTomorrow5pm = resolveScheduledTime("Tomorrow at 5 PM", { anchorDate: anchor });
  console.log("Tomorrow at 5 PM -> Local:", resTomorrow5pm.localFormatted, "| UTC:", resTomorrow5pm.scheduledDate.toISOString());
  assert(resTomorrow5pm.localFormatted.includes("2026-10-15 17:00"), "Tomorrow at 5 PM parses to 2026-10-15 17:00 EAT");
  assert(resTomorrow5pm.scheduledDate.toISOString() === "2026-10-15T14:00:00.000Z", "UTC date matches UTC+3 offset (14:00:00Z)");
  assert(resTomorrow5pm.recurrenceRule === null, "One-shot message has no recurrence");

  // 1b. Tomorrow at 9 AM (09:00 EAT = 06:00 UTC)
  const resTomorrow9am = resolveScheduledTime("Tomorrow at 9 AM", { anchorDate: anchor });
  assert(resTomorrow9am.localFormatted.includes("2026-10-15 09:00"), "Tomorrow at 9 AM parses to 2026-10-15 09:00 EAT");
  assert(resTomorrow9am.scheduledDate.toISOString() === "2026-10-15T06:00:00.000Z", "UTC date matches 06:00:00Z");

  // 1c. Every weekday at 8 AM (Recurrence: weekdays)
  const resWeekdays = resolveScheduledTime("Every weekday at 8 AM", { anchorDate: anchor });
  assert(resWeekdays.recurrenceRule === "weekdays", "Detects recurrence rule 'weekdays'");
  assert(resWeekdays.localFormatted.includes("08:00"), "Target hour is 08:00 EAT");

  // 1d. Relative offset ("in 2 hours")
  const resIn2Hours = resolveScheduledTime("in 2 hours", { anchorDate: anchor });
  const diffHours = (resIn2Hours.scheduledDate.getTime() - anchor.getTime()) / (3600 * 1000);
  assert(diffHours === 2, "'in 2 hours' resolves to exactly +2 hours from anchor");

  // -------------------------------------------------------------------------
  // TEST 2: Recipient Resolution (Individual & Group)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 2: Recipient Directory & Access Resolution ---");

  // 2a. Self / Abbay
  const recSelf = await resolveRecipient("me");
  assert(recSelf.type === "self", "Resolves 'me' as self");
  assert(recSelf.chatId === "375975361", "Self uses authorized user ID 375975361");
  assert(recSelf.isConfigured === true, "Self is marked as configured");

  // 2b. Team Member without connected Telegram chat
  const recDani = await resolveRecipient("Dani");
  assert(recDani.name === "Dani", "Identifies team member Dani");
  assert(recDani.type === "user", "Recipient type is user");
  assert(recDani.isConfigured === false, "Unconnected chat ID recognized as isConfigured: false");

  // 2c. Register and resolve group recipient
  await registerRecipient({
    name: "Graphics Department",
    type: "group",
    chatId: "-1001234567890",
    notes: "Main Abbay TV Graphics Team Broadcast Group",
  });

  const recGroup = await resolveRecipient("Graphics Department");
  assert(recGroup.name === "Graphics Department", "Resolves registered group");
  assert(recGroup.chatId === "-1001234567890", "Returns registered group chat ID");
  assert(recGroup.isConfigured === true, "Registered group is marked as configured");

  // -------------------------------------------------------------------------
  // TEST 3: Persistent Scheduled Message Creation (SQLite)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 3: Persistent Job Creation & Storage in SQLite ---");

  // 3a. Schedule reminder for Dani
  const job1 = await createScheduledMessage({
    recipient: "Dani",
    actionType: "direct_message",
    scheduledTimeText: "Tomorrow at 5 PM",
    content: "Please finish the thumbnails for the broadcast.",
    anchorDate: anchor,
  });

  assert(job1.scheduledAction.id !== undefined, "Job 1 created with persistent ID");
  assert(job1.scheduledAction.recipientName === "Dani", "Recipient stored as Dani");
  assert(job1.scheduledAction.status === "pending", "Initial status is pending");
  assert(job1.confirmationMessage.includes("Tomorrow at 5 PM") || job1.confirmationMessage.includes("17:00"), "Confirmation mentions scheduled time");
  assert(job1.confirmationMessage.includes("Recipient Notice"), "Explains Dani's chat ID is not yet connected");

  // 3b. Schedule report for Graphics Department group
  const job2 = await createScheduledMessage({
    recipient: "Graphics Department",
    actionType: "task_report",
    scheduledTimeText: "Tomorrow at 9 AM",
    reportType: "pending_tasks",
    anchorDate: anchor,
  });

  assert(job2.scheduledAction.targetChatId === "-1001234567890", "Group job stores resolved chat ID");
  assert(job2.scheduledAction.reportType === "pending_tasks", "Report type set to pending_tasks");

  // 3c. Schedule recurring weekday summary for Abbay (self)
  const job3 = await createScheduledMessage({
    recipient: "me",
    actionType: "deadline_summary",
    scheduledTimeText: "Every weekday at 8 AM",
    reportType: "today_deadlines",
    anchorDate: anchor,
  });

  assert(job3.scheduledAction.recurrenceRule === "weekdays", "Recurring rule stored in SQLite");
  assert(job3.scheduledAction.targetChatId === "375975361", "Self job targets authorized user ID");

  // -------------------------------------------------------------------------
  // TEST 4: Scheduled Message Listing & Inspection
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 4: Job Listing & Status Inspection ---");
  const allScheduled = await listScheduledMessages({ status: "pending" });
  assert(allScheduled.length >= 3, "Lists at least 3 pending scheduled messages", `Found: ${allScheduled.length}`);
  const daniJob = allScheduled.find((m) => m.recipient === "Dani");
  assert(daniJob !== undefined, "Finds Dani's scheduled reminder in list");

  // -------------------------------------------------------------------------
  // TEST 5: Job Rescheduling & Editing
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 5: Rescheduling & Job Editing ---");
  const updateRes = await updateScheduledMessage("Graphics Department", {
    newScheduledTimeText: "Tomorrow at 6 PM",
    anchorDate: anchor,
  });

  assert(updateRes.success === true, "Successfully updated scheduled job time");
  assert(updateRes.scheduledAction?.scheduledFor.toISOString().includes("15:00:00.000Z"), "6 PM EAT stored as 15:00:00Z in SQLite");

  // -------------------------------------------------------------------------
  // TEST 6: Job Cancellation
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 6: Job Cancellation ---");
  const cancelRes = await cancelScheduledMessage("Dani", "User requested cancel");
  assert(cancelRes.success === true, "Successfully cancelled Dani's reminder");
  assert(cancelRes.scheduledAction?.status === "cancelled", "Status updated to 'cancelled' in database");

  // Verify cancelled job no longer appears in pending list
  const pendingAfterCancel = await listScheduledMessages({ status: "pending" });
  const cancelledFound = pendingAfterCancel.find((m) => m.id === job1.scheduledAction.id);
  assert(cancelledFound === undefined, "Cancelled job is excluded from pending execution list");

  // -------------------------------------------------------------------------
  // TEST 7: Execution-Time Dynamic Report Generation (Zero Stale Data)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 7: Dynamic Report Generation at Execution Time ---");
  const pendingReportText = await generateReportContent("pending_tasks");
  assert(pendingReportText.includes("Abbay TV Graphics"), "Pending tasks report generated");
  assert(pendingReportText.includes("Due:"), "Report contains task deadlines");

  const deadlinesReportText = await generateReportContent("today_deadlines");
  assert(deadlinesReportText.includes("Today's Focus"), "Deadlines report generated");

  const workloadReportText = await generateReportContent("department_workload");
  assert(workloadReportText.includes("Dani"), "Workload report includes Dani");
  assert(workloadReportText.includes("load"), "Workload report includes load percentages");

  // -------------------------------------------------------------------------
  // TEST 8: Execution Engine & Recurrence Advancement
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 8: Execution Worker & Recurrence Advancement ---");

  // Create a due test job scheduled 5 minutes in the past
  const pastDueJob = await db.scheduledMessage.create({
    data: {
      actionType: "deadline_summary",
      recipientType: "self",
      recipientName: "Abbay (Self)",
      targetChatId: "375975361",
      reportType: "today_deadlines",
      scheduledFor: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
      timezone: "Africa/Addis_Ababa",
      recurrenceRule: "daily",
      status: "pending",
    },
  });

  console.log(`Created past due recurring test job: ${pastDueJob.id}`);
  // Execute due messages with simulated send
  const workerRes = await executeDueScheduledMessages({ now: new Date() });
  console.log(`Worker execution result: executed=${workerRes.executed}, failed=${workerRes.failed}`);

  // Fetch updated job from database
  const refreshedJob = await db.scheduledMessage.findUnique({ where: { id: pastDueJob.id } });
  assert(refreshedJob !== null, "Refreshed recurring job exists in database");
  if (refreshedJob) {
    // For a recurring job, it should have advanced to tomorrow and returned to pending
    assert(refreshedJob.scheduledFor.getTime() > Date.now(), "Recurring job scheduledFor advanced into the future");
    assert(refreshedJob.status === "pending", "Recurring job reset status to 'pending' for next cycle");
    assert(refreshedJob.sentAt !== null, "sentAt timestamp recorded");

    // Clean up test job
    await db.scheduledMessage.delete({ where: { id: refreshedJob.id } });
  }

  // -------------------------------------------------------------------------
  // TEST 9: AI Conversational Command Pipeline for Scheduling
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 9: AI Conversational Command Execution ---");

  // 9a. Natural language scheduling request
  const aiSchedQuery = "Tomorrow at 5 PM, message Dani and remind him to finish the thumbnails";
  const aiSchedRes = await processUserMessage(aiSchedQuery, `sched_test_${Date.now()}`);
  assert(aiSchedRes.content.length > 0, "AI returned response for scheduling command");
  assert(
    aiSchedRes.content.includes("Dani") || aiSchedRes.content.includes("5 PM") || aiSchedRes.content.includes("17:00"),
    "AI response acknowledges scheduled reminder for Dani",
    aiSchedRes.content.slice(0, 120)
  );
  assert(
    aiSchedRes.toolCalls?.some((t) => t.name === "schedule_telegram_message"),
    "AI called 'schedule_telegram_message' tool"
  );

  // 9b. Natural language inspection request
  const aiListQuery = "What messages do I have scheduled?";
  const aiListRes = await processUserMessage(aiListQuery, `sched_list_${Date.now()}`);
  assert(
    aiListRes.toolCalls?.some((t) => t.name === "list_scheduled_messages"),
    "AI called 'list_scheduled_messages' tool"
  );

  // Clean up test records created during test suite
  await db.scheduledMessage.deleteMany({
    where: {
      OR: [
        { id: job2.scheduledAction.id },
        { id: job3.scheduledAction.id },
        { recipientName: "Dani" },
      ],
    },
  });
  console.log("✓ Cleaned up test scheduled messages");

  // -------------------------------------------------------------------------
  // TEST 10: Telegram Poller fromName Definition Verification
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 10: Poller fromName Bug Regression Guard ---");
  const pollerCode = fs.readFileSync(path.join(__dirname, "telegram_poll.js"), "utf8");
  assert(
    pollerCode.includes("const fromName = update.message?.from?.first_name || 'User';"),
    "telegram_poll.js safely defines fromName before logging"
  );
  assert(
    pollerCode.includes("/api/scheduler/tick"),
    "telegram_poll.js includes background scheduler tick"
  );

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n===============================================================");
  console.log(`MASTER MISSION VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================\n");

  if (failed > 0) process.exit(1);
}

runMasterVerification()
  .catch((e) => {
    console.error("Fatal error during master verification:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
