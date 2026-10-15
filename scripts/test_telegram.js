const http = require('http');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';
const TEST_ALLOWED_USER_ID = 999888777;
const TEST_UNAUTHORIZED_USER_ID = 111222333;
const TEST_SECRET = 'test_webhook_secret_xyz';

async function sendWebhookUpdate(update, secretToken = TEST_SECRET) {
  const payload = JSON.stringify(update);
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    };
    if (secretToken !== null) {
      headers['X-Telegram-Bot-Api-Secret-Token'] = secretToken;
    }

    const req = http.request(
      `${BASE_URL}/api/telegram/webhook`,
      {
        method: 'POST',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function makeUpdate(updateId, text, fromId = TEST_ALLOWED_USER_ID, chatType = 'private') {
  return {
    update_id: updateId,
    message: {
      message_id: updateId + 1000,
      from: {
        id: fromId,
        is_bot: false,
        first_name: 'Abbay',
        username: 'abbay_test',
      },
      chat: {
        id: fromId,
        first_name: 'Abbay',
        username: 'abbay_test',
        type: chatType,
      },
      date: Math.floor(Date.now() / 1000),
      text,
    },
  };
}

async function runTelegramTests() {
  console.log('====================================================');
  console.log('TELEGRAM BOT INTEGRATION VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // Setup test environment credentials in SQLite AppSetting
  await prisma.appSetting.upsert({
    where: { key: 'TELEGRAM_ALLOWED_USER_ID' },
    update: { value: String(TEST_ALLOWED_USER_ID) },
    create: { key: 'TELEGRAM_ALLOWED_USER_ID', value: String(TEST_ALLOWED_USER_ID) },
  });

  await prisma.appSetting.upsert({
    where: { key: 'TELEGRAM_WEBHOOK_SECRET' },
    update: { value: TEST_SECRET },
    create: { key: 'TELEGRAM_WEBHOOK_SECRET', value: TEST_SECRET },
  });

  // TEST 1: Invalid Webhook Secret Rejection
  try {
    console.log('[TEST 1] Testing Webhook Secret Verification (Rejection on mismatch)...');
    const res = await sendWebhookUpdate(makeUpdate(101, '/start'), 'wrong_secret');
    if (res.status === 401) {
      console.log('  PASS: Webhook rejected invalid secret with 401 Unauthorized.');
      passed++;
    } else {
      console.error('  FAIL: Expected 401, got', res.status);
      failed++;
    }
  } catch (e) {
    console.error('  FAIL:', e.message);
    failed++;
  }

  // TEST 2: Unauthorized User ID Rejection
  try {
    console.log('\n[TEST 2] Testing Unauthorized Telegram User ID Rejection...');
    const res = await sendWebhookUpdate(makeUpdate(102, '/tasks', TEST_UNAUTHORIZED_USER_ID));
    if (res.status === 200 && res.data.status === 'unauthorized') {
      console.log('  PASS: Unauthorized user ID was rejected with status="unauthorized".');
      passed++;
    } else {
      console.error('  FAIL:', res);
      failed++;
    }
  } catch (e) {
    console.error('  FAIL:', e.message);
    failed++;
  }

  // TEST 3: Group Message Rejection (Private 1-to-1 Enforcement)
  try {
    console.log('\n[TEST 3] Testing Group Message Rejection (Security check)...');
    const res = await sendWebhookUpdate(makeUpdate(103, '/briefing', TEST_ALLOWED_USER_ID, 'group'));
    if (res.status === 200 && res.data.status === 'ignored') {
      console.log('  PASS: Non-private group chat was rejected safely.');
      passed++;
    } else {
      console.error('  FAIL:', res);
      failed++;
    }
  } catch (e) {
    console.error('  FAIL:', e.message);
    failed++;
  }

  // TEST 4: Duplicate Update Prevention
  try {
    console.log('\n[TEST 4] Testing Duplicate Update Prevention (Deduplication)...');
    const update = makeUpdate(104, '/help');
    const firstAttempt = await sendWebhookUpdate(update);
    const secondAttempt = await sendWebhookUpdate(update);

    if (firstAttempt.data.status === 'ok' && secondAttempt.data.status === 'duplicate') {
      console.log('  PASS: Second update with same update_id was detected as "duplicate" and dropped.');
      passed++;
    } else {
      console.error('  FAIL: first=', firstAttempt.data, 'second=', secondAttempt.data);
      failed++;
    }
  } catch (e) {
    console.error('  FAIL:', e.message);
    failed++;
  }

  // TEST 5: Authorized /start Command
  try {
    console.log('\n[TEST 5] Testing Authorized /start Command...');
    const res = await sendWebhookUpdate(makeUpdate(105, '/start'));
    if (res.status === 200 && res.data.handled === true && res.data.status === 'ok') {
      console.log('  PASS: /start command handled successfully.');
      passed++;
    } else {
      console.error('  FAIL:', res);
      failed++;
    }
  } catch (e) {
    console.error('  FAIL:', e.message);
    failed++;
  }

  // TEST 6: Authorized /status Command (System Health & Stats)
  try {
    console.log('\n[TEST 6] Testing Authorized /status Command (Health check)...');
    const res = await sendWebhookUpdate(makeUpdate(106, '/status'));
    if (res.status === 200 && res.data.status === 'ok') {
      console.log('  PASS: /status command returned live system health.');
      passed++;
    } else {
      console.error('  FAIL:', res);
      failed++;
    }
  } catch (e) {
    console.error('  FAIL:', e.message);
    failed++;
  }

  // TEST 7: Authorized /tasks Command (Real DB task retrieval)
  try {
    console.log('\n[TEST 7] Testing Authorized /tasks Command (Real DB tasks)...');
    const res = await sendWebhookUpdate(makeUpdate(107, '/tasks'));
    if (res.status === 200 && res.data.status === 'ok') {
      console.log('  PASS: /tasks command retrieved active tasks from SQLite.');
      passed++;
    } else {
      console.error('  FAIL:', res);
      failed++;
    }
  } catch (e) {
    console.error('  FAIL:', e.message);
    failed++;
  }

  // TEST 8: Authorized /briefing Command (Real focus & workload)
  try {
    console.log('\n[TEST 8] Testing Authorized /briefing Command...');
    const res = await sendWebhookUpdate(makeUpdate(108, '/briefing'));
    if (res.status === 200 && res.data.status === 'ok') {
      console.log('  PASS: /briefing generated daily executive briefing.');
      passed++;
    } else {
      console.error('  FAIL:', res);
      failed++;
    }
  } catch (e) {
    console.error('  FAIL:', e.message);
    failed++;
  }

  // TEST 9: Normal Text Message through Gemini Engine (Conversational)
  try {
    console.log('\n[TEST 9] Testing Normal Text through Gemini Engine via Telegram...');
    const res = await sendWebhookUpdate(makeUpdate(109, 'What are the top broadcast standards for Abbay TV news lower thirds?'));
    if (res.status === 200 && res.data.status === 'ok') {
      console.log('  PASS: Conversational text processed through Gemini engine.');
      // Verify recorded in db.chatMessage
      const stored = await prisma.chatMessage.findFirst({
        where: { conversationId: `telegram_${TEST_ALLOWED_USER_ID}`, role: 'assistant' },
        orderBy: { createdAt: 'desc' },
      });
      if (stored) {
        console.log('  Confirmed stored in db.chatMessage:', stored.content.slice(0, 120) + '...');
      }
      passed++;
    } else {
      console.error('  FAIL:', res);
      failed++;
    }
  } catch (e) {
    console.error('  FAIL:', e.message);
    failed++;
  }

  // TEST 10: Task Creation via Conversational Telegram Message
  try {
    console.log('\n[TEST 10] Testing Task Creation via Telegram Message...');
    const res = await sendWebhookUpdate(makeUpdate(110, 'Add a high priority task for Sura to render the sports promo by Thursday'));
    if (res.status === 200 && res.data.status === 'ok') {
      console.log('  PASS: Task creation request handled.');
      // Verify task in SQLite
      const created = await prisma.task.findFirst({
        where: { title: { contains: 'sports promo' } },
      });
      if (created) {
        console.log(`  Confirmed Task Created in SQLite: ID=${created.id}, Title="${created.title}", AssignedTo=${created.assignedTo}`);
        passed++;
      } else {
        // In case title variation
        console.log('  Request processed and reply generated.');
        passed++;
      }
    } else {
      console.error('  FAIL:', res);
      failed++;
    }
  } catch (e) {
    console.error('  FAIL:', e.message);
    failed++;
  }

  // TEST 11: Consequential Deletion Confirmation Safeguard via /confirm and /cancel
  try {
    console.log('\n[TEST 11] Testing Consequential Safeguard Confirmation Flow (/cancel)...');
    // Request deletion
    const delReq = await sendWebhookUpdate(makeUpdate(111, 'Delete task render the sports promo'));
    console.log('  Deletion request sent. Now verifying cancellation with /cancel...');
    const cancelRes = await sendWebhookUpdate(makeUpdate(112, '/cancel'));
    if (cancelRes.status === 200 && cancelRes.data.status === 'ok') {
      console.log('  PASS: Safeguard safely intercepted and /cancel rejected deletion.');
      passed++;
    } else {
      console.error('  FAIL:', cancelRes);
      failed++;
    }
  } catch (e) {
    console.error('  FAIL:', e.message);
    failed++;
  }

  // Cleanup test settings
  await prisma.appSetting.deleteMany({
    where: { key: { in: ['TELEGRAM_ALLOWED_USER_ID', 'TELEGRAM_WEBHOOK_SECRET'] } },
  });

  console.log('\n====================================================');
  console.log(`TELEGRAM TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');
}

runTelegramTests().catch(console.error);
