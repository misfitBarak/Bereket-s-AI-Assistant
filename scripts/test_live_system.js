const http = require('http');

function post(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let respData = '';
        res.on('data', (chunk) => (respData += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(respData) });
          } catch {
            resolve({ status: res.statusCode, raw: respData });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    http.get(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
      },
      (res) => {
        let respData = '';
        res.on('data', (chunk) => (respData += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(respData) });
          } catch {
            resolve({ status: res.statusCode, raw: respData });
          }
        });
      }
    ).on('error', reject);
  });
}

async function runLiveTests() {
  console.log('========================================================');
  console.log('🌐 RUNNING LIVE HTTP & TELEGRAM INTEGRATION TESTS');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName} ${detail ? `(${detail})` : ''}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // TEST 1: Analytics Endpoint
  console.log('--- TEST 1: Analytics API Endpoint ---');
  const analyticsRes = await get('http://localhost:3000/api/analytics');
  assert(analyticsRes.status === 200, 'GET /api/analytics returns 200');
  const stats = analyticsRes.data?.stats;
  assert(stats?.totalTasks === 21, 'Analytics totalTasks === 21', `Got: ${stats?.totalTasks}`);
  assert(stats?.activeTasks === 19, 'Analytics activeTasks === 19', `Got: ${stats?.activeTasks}`);
  assert(stats?.urgentTasks === 5, 'Analytics urgentTasks === 5', `Got: ${stats?.urgentTasks}`);
  assert(stats?.completedTasks === 2, 'Analytics completedTasks === 2', `Got: ${stats?.completedTasks}`);
  assert(stats?.teamWorkload?.length === 6, 'Analytics teamWorkload has 6 artists', `Got: ${stats?.teamWorkload?.length}`);

  // Base update ID using timestamp to avoid duplicate cache collision
  const baseUpdateId = Math.floor(Date.now() / 1000) * 10;

  // TEST 2: Telegram Webhook /status command
  console.log('\n--- TEST 2: Telegram Webhook /status ---');
  const statusUpdate = {
    update_id: baseUpdateId + 1,
    message: {
      message_id: 101,
      from: { id: 375975361, is_bot: false, first_name: 'Abbay' },
      chat: { id: 375975361, type: 'private' },
      text: '/status',
    },
  };
  const statusRes = await post('http://localhost:3000/api/telegram/webhook', statusUpdate);
  assert(statusRes.status === 200, 'POST /api/telegram/webhook (/status) returns 200');
  const statusReply = statusRes.data?.replyText || '';
  assert(statusReply.includes('21 total tasks (19 active, 5 urgent'), 'Status reply contains unified task counts (21 total, 19 active, 5 urgent)', statusReply.slice(0, 100));

  // TEST 3: Telegram Webhook /tasks command
  console.log('\n--- TEST 3: Telegram Webhook /tasks (No 15-Limit Truncation) ---');
  const tasksUpdate = {
    update_id: baseUpdateId + 2,
    message: {
      message_id: 102,
      from: { id: 375975361, is_bot: false, first_name: 'Abbay' },
      chat: { id: 375975361, type: 'private' },
      text: '/tasks',
    },
  };
  const tasksRes = await post('http://localhost:3000/api/telegram/webhook', tasksUpdate);
  assert(tasksRes.status === 200, 'POST /api/telegram/webhook (/tasks) returns 200');
  const tasksReply = tasksRes.data?.replyText || '';
  assert(tasksReply.includes('Active Tasks (19):'), 'Tasks reply shows all 19 active tasks (no hidden 15-truncation)', tasksReply.slice(0, 100));

  // TEST 4: Telegram Webhook /briefing command
  console.log('\n--- TEST 4: Telegram Webhook /briefing ---');
  const briefingUpdate = {
    update_id: baseUpdateId + 3,
    message: {
      message_id: 103,
      from: { id: 375975361, is_bot: false, first_name: 'Abbay' },
      chat: { id: 375975361, type: 'private' },
      text: '/briefing',
    },
  };
  const briefingRes = await post('http://localhost:3000/api/telegram/webhook', briefingUpdate);
  assert(briefingRes.status === 200, 'POST /api/telegram/webhook (/briefing) returns 200');
  const briefingReply = briefingRes.data?.replyText || '';
  assert(briefingReply.includes('Priority Deliverables'), 'Briefing contains Priority Deliverables');
  assert(briefingReply.includes('Graphics Department Load'), 'Briefing contains Graphics Department Load');
  assert(briefingReply.includes('Dani'), 'Briefing includes team member Dani');
  assert(briefingReply.includes('Workload Strategy'), 'Briefing includes Workload Strategy');

  // TEST 5: Security - Reject Unauthorized User
  console.log('\n--- TEST 5: Security - Reject Unauthorized User ---');
  const unauthUpdate = {
    update_id: baseUpdateId + 4,
    message: {
      message_id: 104,
      from: { id: 987654321, is_bot: false, first_name: 'Hacker' },
      chat: { id: 987654321, type: 'private' },
      text: '/status',
    },
  };
  const unauthRes = await post('http://localhost:3000/api/telegram/webhook', unauthUpdate);
  assert(unauthRes.data?.status === 'unauthorized', 'Unauthorized Telegram user correctly rejected');

  // TEST 6: Security - Reject Group Chats
  console.log('\n--- TEST 6: Security - Reject Group Chats ---');
  const groupUpdate = {
    update_id: baseUpdateId + 5,
    message: {
      message_id: 105,
      from: { id: 375975361, is_bot: false, first_name: 'Abbay' },
      chat: { id: -100123456789, type: 'group' },
      text: '/status',
    },
  };
  const groupRes = await post('http://localhost:3000/api/telegram/webhook', groupUpdate);
  assert(groupRes.data?.status === 'ignored', 'Non-private group chat rejected for security');

  console.log('\n========================================================');
  console.log(`LIVE INTEGRATION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) process.exit(1);
}

runLiveTests().catch((e) => {
  console.error('Test run failed:', e);
  process.exit(1);
});
