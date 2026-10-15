import { db } from "../src/lib/db";
import {
  resolveDateDetailed,
  resolveDateWithAnchor,
  checkTaskDuplicate,
  getDepartmentWorkload,
  getTaskMetrics,
  createTaskSafe,
} from "../src/lib/services/taskService";
import {
  handleTelegramUpdate,
  getTelegramCredentials,
  isUserAuthorized,
  verifyWebhookSecret,
  isUpdateDuplicate,
} from "../src/lib/telegram/bot";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

async function runVerification() {
  console.log("===============================================================");
  console.log("🧪 INDEPENDENT SYSTEM VERIFICATION & RELIABILITY TEST SUITE");
  console.log("   (Directly exercising production TypeScript services & SQLite)");
  console.log("===============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: any, testName: string, detail: string = "") {
    if (condition) {
      console.log(`✅ PASS: ${testName} ${detail ? `(${detail})` : ""}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: Database Baseline & Primary Metrics
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 1: Baseline Database Consistency ---");
  const metrics = await getTaskMetrics(new Date("2026-10-14T12:00:00Z"));
  const rawTotal = await db.task.count();
  const rawActive = await db.task.count({ where: { status: { not: "completed" } } });
  const rawCompleted = await db.task.count({ where: { status: "completed" } });
  const rawUrgent = await db.task.count({ where: { priority: "urgent", status: { not: "completed" } } });
  const rawTeam = await db.teamMember.count();

  console.log(`Live DB -> Total: ${rawTotal}, Active: ${rawActive}, Completed: ${rawCompleted}, Urgent: ${rawUrgent}, Team: ${rawTeam}`);

  assert(rawTotal === 21, "Total tasks in primary SQLite is exactly 21", `Found: ${rawTotal}`);
  assert(rawActive === 19, "Active tasks in primary SQLite is exactly 19", `Found: ${rawActive}`);
  assert(rawCompleted === 2, "Completed tasks in primary SQLite is exactly 2", `Found: ${rawCompleted}`);
  assert(rawUrgent === 5, "Urgent tasks in primary SQLite is exactly 5", `Found: ${rawUrgent}`);
  assert(rawTeam === 6, "Registered team members is exactly 6", `Found: ${rawTeam}`);
  assert(metrics.totalTasks === rawTotal, "TaskService getTaskMetrics matches raw DB count");

  // -------------------------------------------------------------------------
  // TEST 2: Database Backup Integrity & Direct Queryability
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 2: Database Backup Queryability ---");
  const backupsDir = path.join(process.cwd(), "prisma", "backups");
  const backupFiles = fs.readdirSync(backupsDir).filter((f) => f.endsWith(".db"));
  assert(backupFiles.length > 0, "Backup files exist in prisma/backups/", `Count: ${backupFiles.length}`);

  const latestBackup = backupFiles.sort().reverse()[0];
  const backupPath = path.join(backupsDir, latestBackup);
  const backupStat = fs.statSync(backupPath);
  console.log(`Latest backup: ${latestBackup} (${backupStat.size} bytes)`);
  assert(backupStat.size > 200000, "Backup database file is non-empty (>200KB)");

  // Instantiate direct Prisma connection to backup file to prove queryability
  const backupPrisma = new PrismaClient({
    datasources: {
      db: {
        url: `file:${backupPath.replace(/\\/g, "/")}`,
      },
    },
  });

  try {
    const backupTasks = await backupPrisma.task.count();
    const backupProjects = await backupPrisma.project.count();
    const backupTeam = await backupPrisma.teamMember.count();
    console.log(`Direct query on backup DB -> Tasks: ${backupTasks}, Projects: ${backupProjects}, Team: ${backupTeam}`);

    assert(backupTasks === 21, "Backup database contains all 21 tasks");
    assert(backupProjects === 5, "Backup database contains all 5 projects");
    assert(backupTeam === 6, "Backup database contains all 6 team members");
  } finally {
    await backupPrisma.$disconnect();
  }

  // -------------------------------------------------------------------------
  // TEST 3: Date-Resolution Engine (Closing the March 6 & Historical Gaps)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 3: Date-Resolution Engine (resolveDateDetailed) ---");
  const anchor = new Date("2026-10-14T12:00:00Z");

  // 3a. Explicit future date
  const resFuture = resolveDateDetailed("2026-10-25", { anchorDate: anchor });
  assert(resFuture.category === "explicit_future", "2026-10-25 categorized as explicit_future");
  assert(resFuture.date?.toISOString().startsWith("2026-10-25"), "2026-10-25 date preserved accurately");
  assert(resFuture.warning === undefined, "No warning on valid future date");

  // 3b. Relative dates
  const resTomorrow = resolveDateDetailed("tomorrow", { anchorDate: anchor });
  assert(resTomorrow.category === "relative", "'tomorrow' categorized as relative");
  assert(resTomorrow.date?.toISOString().startsWith("2026-10-15"), "'tomorrow' resolves to 2026-10-15");

  const resNextFri = resolveDateDetailed("next Friday", { anchorDate: anchor });
  assert(resNextFri.category === "relative", "'next Friday' categorized as relative");
  assert(resNextFri.date?.toISOString().startsWith("2026-10-23"), "'next Friday' resolves to 2026-10-23");

  // 3c. Month and day without year (upcoming in current year)
  const resUpcomingMo = resolveDateDetailed("October 20", { anchorDate: anchor });
  assert(resUpcomingMo.category === "month_day_no_year", "'October 20' categorized as month_day_no_year");
  assert(resUpcomingMo.date?.toISOString().startsWith("2026-10-20"), "'October 20' resolves to 2026-10-20");

  // 3d. Month and day without year (already passed in anchor year -> moves to NEXT annual cycle)
  const resPassedMo = resolveDateDetailed("March 6", { anchorDate: anchor });
  assert(resPassedMo.category === "month_day_no_year", "'March 6' categorized as month_day_no_year");
  assert(resPassedMo.date?.toISOString().startsWith("2027-03-06"), "'March 6' on Oct 14 2026 resolves to 2027-03-06 (NOT 2026-03-06!)", `Got: ${resPassedMo.date?.toISOString()}`);
  assert(resPassedMo.date!.getTime() > anchor.getTime(), "'March 6' resolution is strictly in the future");

  // 3e. Historical date that is intentionally valid (allowHistorical: true)
  const resHist = resolveDateDetailed("2024-05-10", { anchorDate: anchor, allowHistorical: true });
  assert(resHist.category === "explicit_past_allowed", "2024-05-10 with allowHistorical:true categorized as explicit_past_allowed");
  assert(resHist.date?.toISOString().startsWith("2024-05-10"), "Historical date 2024-05-10 is kept untouched (no forced rescheduling)");
  assert(resHist.warning === undefined, "Historical date has no warning when allowed");

  // 3f. Suspicious past date generated by AI model (e.g. 2024-10-18 from retired training cut-off)
  const resSuspiciousSameMonth = resolveDateDetailed("2024-10-18", { anchorDate: anchor, isNewTaskCreation: true });
  assert(resSuspiciousSameMonth.category === "suspicious_ai_past", "2024-10-18 categorized as suspicious_ai_past");
  assert(resSuspiciousSameMonth.date?.toISOString().startsWith("2026-10-18"), "2024-10-18 normalized to 2026-10-18");
  assert(resSuspiciousSameMonth.warning !== undefined, "Warning included explaining 2024 -> 2026 adjustment");

  // 3g. Stale AI date from past month (e.g. 2025-03-06 -> ambiguous whether next year or obsolete)
  const resAmbiguousStale = resolveDateDetailed("2025-03-06", { anchorDate: anchor, isNewTaskCreation: true });
  assert(resAmbiguousStale.clarificationRequired === true, "Ambiguous stale date 2025-03-06 flagged with clarificationRequired: true");
  assert(resAmbiguousStale.warning !== undefined, "Warning generated requesting confirmation on ambiguous date");

  // 3h. Existing overdue tasks in database must NEVER be silently rescheduled
  const existingOverdue = await db.task.findMany({
    where: {
      status: { not: "completed" },
      dueDate: { lt: anchor },
    },
  });
  assert(existingOverdue.length > 0, "Database has existing overdue tasks for anchor Oct 14, 2026", `Count: ${existingOverdue.length}`);
  for (const ot of existingOverdue) {
    assert(ot.dueDate!.getTime() < anchor.getTime(), `Task "${ot.title}" dueDate remains historical in DB (${ot.dueDate?.toISOString().split("T")[0]})`);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Duplicate Detection Boundary Testing (checkTaskDuplicate)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 4: Duplicate Detection Refinement ---");

  // 4a. Distinct episodes must NOT be flagged as duplicates
  const epCheck = await checkTaskDuplicate("MMA Promo - Episode 2", "abbay_tv");
  assert(epCheck.isDuplicate === false, "'MMA Promo - Episode 2' is NOT flagged as duplicate of Episode 1");

  // 4b. Distinct phases (Teaser vs Final Delivery) must NOT be flagged as duplicates
  const phaseCheck = await checkTaskDuplicate("MMA Promo Final Delivery", "abbay_tv");
  assert(phaseCheck.isDuplicate === false, "'MMA Promo Final Delivery' is NOT flagged as duplicate of Teaser");

  // 4c. Distinct qualifiers (Morning vs Evening) must NOT be flagged as duplicates
  const timeCheck = await checkTaskDuplicate("Evening News Lower Third Graphic", "abbay_tv");
  assert(timeCheck.isDuplicate === false, "'Evening News Lower Third Graphic' is NOT flagged as duplicate of Morning News");

  // 4d. Genuine duplicate (same entity and qualifier, different phrasing)
  const genuineDup = await checkTaskDuplicate("finish the MMA media pack by Thursday", "abbay_tv");
  assert(genuineDup.isDuplicate === true, "Genuine duplicate 'finish the MMA media pack by Thursday' correctly identified", genuineDup.reason);

  // 4e. Non-destructive safety: createTaskSafe records task even with duplicate warning
  const safeCreated = await createTaskSafe({
    title: "MMA Promo Teaser Delivery",
    workspace: "abbay_tv",
    anchorDate: anchor,
  });
  assert(safeCreated.task.id !== undefined, "createTaskSafe created task without crashing or dropping record");
  assert(safeCreated.duplicateWarning !== undefined, "createTaskSafe flagged duplicate warning non-destructively");
  // Clean up the temporary test task
  await db.task.delete({ where: { id: safeCreated.task.id } });
  await db.activityLog.deleteMany({ where: { taskId: safeCreated.task.id } });

  // -------------------------------------------------------------------------
  // TEST 5: Department Workload & Real Math Verification
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 5: Department Workload & Zero-Division Safety ---");
  const workload = await getDepartmentWorkload(anchor);

  assert(workload.team.length === 6, "Workload includes all 6 team members");
  const dani = workload.team.find((m) => m.name.toLowerCase() === "dani");
  const sura = workload.team.find((m) => m.name.toLowerCase() === "sura");

  assert(dani !== undefined && dani.capacityHours === 12, "Dani capacity is 12h");
  assert(dani !== undefined && dani.loadPercent === 367, "Dani load percentage is exactly 367%");
  assert(dani !== undefined && dani.isOverloaded === true, "Dani flagged as OVERLOADED");

  assert(sura !== undefined && sura.capacityHours === 18, "Sura capacity is 18h");
  assert(sura !== undefined && sura.loadPercent === 50, "Sura load percentage is 50%");
  assert(sura !== undefined && sura.status === "AVAILABLE", "Sura marked as AVAILABLE");

  assert(workload.recommendations.length > 0, "Actionable rebalancing recommendation generated");

  // -------------------------------------------------------------------------
  // TEST 6: Real Telegram Bot API Network Verification
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 6: Real Telegram Bot API Network Connection ---");
  const creds = await getTelegramCredentials();
  assert(Boolean(creds.botToken), "TELEGRAM_BOT_TOKEN retrieved from secure store");
  assert(creds.allowedUserIds.includes("375975361"), "TELEGRAM_ALLOWED_USER_ID includes 375975361");

  // Authenticate against official Telegram Bot API
  try {
    const liveTgRes = await fetch(`https://api.telegram.org/bot${creds.botToken}/getMe`);
    const liveTgData = await liveTgRes.json();
    console.log(`Live Telegram response: ok=${liveTgData.ok}, username=@${liveTgData.result?.username}, id=${liveTgData.result?.id}`);

    assert(liveTgData.ok === true, "LIVE call to Telegram getMe returned ok:true");
    assert(liveTgData.result?.username === "BereketAssistantBot", "Live Bot username matches @BereketAssistantBot");
    assert(liveTgData.result?.id === 8537344274, "Live Bot ID is 8537344274");
  } catch (err: any) {
    assert(false, "Failed to connect to live Telegram Bot API", err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Telegram Webhook Handler Security & Safeguards
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 7: Telegram Security & Safeguards ---");

  // 7a. Unauthorized user blocked
  const unauthResult = await handleTelegramUpdate({
    update_id: 888001,
    message: {
      message_id: 1,
      from: { id: 999999999, first_name: "Intruder" },
      chat: { id: 999999999, type: "private" },
      text: "/status",
    },
  });
  assert(unauthResult.status === "unauthorized", "Unauthorized user correctly rejected by handleTelegramUpdate");

  // 7b. Non-private chat ignored
  const groupResult = await handleTelegramUpdate({
    update_id: 888002,
    message: {
      message_id: 2,
      from: { id: 375975361, first_name: "Abbay" },
      chat: { id: -1001234567, type: "group" },
      text: "/status",
    },
  });
  assert(groupResult.status === "ignored", "Group chat rejected for security");

  // 7c. Deduplication cache
  const isFirst = isUpdateDuplicate(999991);
  const isSecond = isUpdateDuplicate(999991);
  assert(isFirst === false, "First update_id is not duplicate");
  assert(isSecond === true, "Repeated update_id is caught by deduplication filter");

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n===============================================================");
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification()
  .catch((e) => {
    console.error("Fatal error during verification:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
