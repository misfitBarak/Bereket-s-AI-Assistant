import * as path from "path";
import * as fs from "fs";

// 1. Point to an isolated test database to protect production data completely
const testDbPath = path.resolve(__dirname, "../prisma/test_fallback.db");
const devBackupPath = path.resolve(__dirname, "../prisma/backups/dev_backup_gemini_503_fix.db");

// Copy clean backup to test database
fs.copyFileSync(devBackupPath, testDbPath);
process.env.DATABASE_URL = `file:${testDbPath}`;

import { db } from "../src/lib/db";
import { processUserMessage } from "../src/lib/ai/engine";
import { setPersonalClientMock } from "../src/lib/telegram/personalClient";
import { resolveScheduledTime, resolveRecipient } from "../src/lib/services/schedulerService";

async function runGemini503FallbackTests() {
  console.log("===============================================================");
  console.log("🧪 GEMINI 503 FALLBACK & RELIABILITY TEST SUITE");
  console.log("   (Isolated Test DB: prisma/test_fallback.db)");
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

  try {
    // Ensure baseline settings in test database
    await db.appSetting.upsert({
      where: { key: "AI_PROVIDER" },
      create: { key: "AI_PROVIDER", value: "gemini" },
      update: { value: "gemini" },
    });
    await db.appSetting.upsert({
      where: { key: "GEMINI_API_KEY" },
      create: { key: "GEMINI_API_KEY", value: "mock_gemini_key_for_test" },
      update: { value: "mock_gemini_key_for_test" },
    });
    await db.appSetting.upsert({
      where: { key: "TELEGRAM_CONTACT_ALIASES" },
      create: { key: "TELEGRAM_CONTACT_ALIASES", value: JSON.stringify({ wife: "Tigist Haile" }) },
      update: { value: JSON.stringify({ wife: "Tigist Haile" }) },
    });

    // Clear any previous scheduled messages in test DB
    await db.scheduledMessage.deleteMany({});

    // Setup Mock for Personal Client (No real Telegram MTProto requests)
    setPersonalClientMock({
      getStatus: async () => ({
        isConfigured: true,
        isConnected: true,
        user: { id: "12345678", firstName: "Abbay", username: "abbay_lead" },
      }),
      getContacts: async () => [
        { id: "987654321", name: "Tigist Haile", isUser: true, isGroup: false, isChannel: false },
        { id: "112233445", name: "Dani", isUser: true, isGroup: false, isChannel: false },
      ],
      getMessages: async () => [],
      sendMessage: async () => ({ success: true, messageId: 99999 }),
    });

    // Intercept global fetch to simulate Gemini 503 and block real Telegram requests
    const originalFetch = global.fetch;
    let geminiCallCount = 0;

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = input.toString();

      // Intercept Gemini API calls and simulate 503 High Demand
      if (urlStr.includes("generativelanguage.googleapis.com")) {
        geminiCallCount++;
        return new Response(
          JSON.stringify({
            error: {
              code: 503,
              message: "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
              status: "UNAVAILABLE",
            },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }

      // Block real Telegram API calls during testing
      if (urlStr.includes("api.telegram.org")) {
        return new Response(JSON.stringify({ ok: true, result: { message_id: 88888 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return originalFetch(input, init);
    };

    // -------------------------------------------------------------------------
    // TEST 1: Wife Alias Resolution in schedulerService
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: Wife Alias Resolution in schedulerService ---");
    const resolvedWife = await resolveRecipient("wife");
    assert(resolvedWife.name === "Tigist Haile", "Resolves 'wife' to alias 'Tigist Haile'", resolvedWife.name);

    const resolvedTheWife = await resolveRecipient("the wife");
    assert(resolvedTheWife.name === "Tigist Haile", "Resolves 'the wife' to alias 'Tigist Haile'", resolvedTheWife.name);

    const resolvedMyWife = await resolveRecipient("my wife");
    assert(resolvedMyWife.name === "Tigist Haile", "Resolves 'my wife' to alias 'Tigist Haile'", resolvedMyWife.name);

    // -------------------------------------------------------------------------
    // TEST 2: Relative Time Parsing in Africa/Addis_Ababa Timezone (UTC+3)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Relative Time Parsing in Africa/Addis_Ababa (UTC+3) ---");
    const anchor = new Date("2026-10-14T21:07:12.000Z"); // 00:07:12 EAT on Oct 15
    const parsed5Min = resolveScheduledTime("in 5 minutes", { anchorDate: anchor });

    const diffMs = parsed5Min.scheduledDate.getTime() - anchor.getTime();
    assert(diffMs === 5 * 60 * 1000, "Calculates exact +5 minute offset in UTC Date", `${diffMs / 1000}s`);
    assert(parsed5Min.localFormatted.includes("2026-10-15 00:12"), "Formats in local Addis Ababa EAT time", parsed5Min.localFormatted);
    assert(parsed5Min.localFormatted.includes("Addis Ababa EAT"), "Explicitly mentions Addis Ababa EAT");

    // -------------------------------------------------------------------------
    // TEST 3: Gemini 503 Fallback Invocation & Voice Text Preservation
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Voice Command Fallback Processing Under Gemini 503 ---");
    const voiceText = "Tell the wife that I'll love her in 5 minutes.";

    const res = await processUserMessage(voiceText, "telegram_test_conv");

    assert(geminiCallCount > 0, "Attempted primary Gemini API call", `Calls: ${geminiCallCount}`);
    assert(res.providerUsed.includes("Autonomous Local Engine"), "Routed to Autonomous Local Engine on 503 error", res.providerUsed);
    assert(res.content.includes("Google Gemini Notice"), "Included transparent notice of Gemini 503", res.content.slice(0, 80));
    assert(res.content.includes("Autonomous Local Engine"), "Announced Autonomous Local Engine activation");
    assert(res.toolCalls && res.toolCalls.length > 0, "Tool calls were actually executed by fallback", JSON.stringify(res.toolCalls));

    const scheduledTool = res.toolCalls?.find((t) => t.name === "schedule_telegram_message");
    assert(scheduledTool !== undefined, "Executed schedule_telegram_message tool");
    assert(scheduledTool?.args.recipient === "wife", "Identified recipient as wife");
    assert(scheduledTool?.args.senderAccount === "personal", "Respected personal senderAccount for wife");
    assert(scheduledTool?.args.content === "I'll love her", "Preserved exact message wording 'I\\'ll love her'", scheduledTool?.args.content);

    // -------------------------------------------------------------------------
    // TEST 4: SQLite Database Persistence
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Database Record Persistence ---");
    const storedJobs = await db.scheduledMessage.findMany({
      where: { recipientName: "Tigist Haile" },
    });

    assert(storedJobs.length === 1, "Persisted exactly 1 scheduled job for Tigist Haile in SQLite", `Count: ${storedJobs.length}`);
    const job = storedJobs[0];
    assert(job?.senderAccount === "personal", "Stored job senderAccount is 'personal'");
    assert(job?.actionType === "direct_message", "Stored job actionType is 'direct_message'");
    assert(job?.content === "I'll love her", "Stored job content matches voice command");
    assert(job?.timezone === "Africa/Addis_Ababa", "Stored job timezone is 'Africa/Addis_Ababa'");
    assert(job?.status === "pending", "Stored job status is 'pending'");

    // -------------------------------------------------------------------------
    // TEST 5: Idempotency & Duplicate Prevention Across Retries
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Idempotency Across Retries (Duplicate Prevention) ---");
    // Simulate immediate retry of the same voice command
    const retryRes = await processUserMessage(voiceText, "telegram_test_conv");

    const jobsAfterRetry = await db.scheduledMessage.findMany({
      where: { recipientName: "Tigist Haile" },
    });

    assert(jobsAfterRetry.length === 1, "Duplicate prevention: Still exactly 1 job in SQLite after retry", `Count: ${jobsAfterRetry.length}`);
    assert(retryRes.content.includes("duplicate prevented") || retryRes.content.includes("Reused existing"), "Informed user that existing job was safely reused");

    // -------------------------------------------------------------------------
    // TEST 6: Ambiguous Message Handling
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Ambiguous Message Handling ---");
    const ambiguousVoice = "Tell the wife in 5 minutes.";
    const ambiguousRes = await processUserMessage(ambiguousVoice, "telegram_test_conv");

    assert(ambiguousRes.content.includes("Please specify") || ambiguousRes.content.includes("unclear"), "Asks for clarification when message text is missing");
    assert(!ambiguousRes.content.includes("I'll be home late"), "Never silently substitutes hardcoded message text");

    // -------------------------------------------------------------------------
    // TEST 7: Truthful Fallback Reporting on Unprocessed Query
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: Truthful Fallback Reporting on Unprocessed Query ---");
    const unknownQuery = "Xyzzy randomly generated unparseable command";
    const unknownRes = await processUserMessage(unknownQuery, "telegram_test_conv");

    assert(!unknownRes.content.includes("successfully processed your request"), "Never claims success when query could not be executed");
    assert(unknownRes.content.includes("Google Gemini Notice"), "Transparently mentions Gemini unavailable");

    // Restore fetch and mock
    global.fetch = originalFetch;
    setPersonalClientMock(null as any);

    console.log("\n===============================================================");
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("===============================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error("Test execution error:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
    // Clean up isolated test DB file
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch {}
  }
}

runGemini503FallbackTests();
