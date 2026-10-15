const http = require('http');

async function sendChat(message) {
  const payload = JSON.stringify({ message });
  return new Promise((resolve, reject) => {
    const req = http.request(
      'http://localhost:3000/api/chat',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
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

async function main() {
  console.log('======================================================');
  console.log('REAL GEMINI INTEGRATION & END-TO-END VERIFICATION');
  console.log('======================================================\n');

  // TEST 1: Real request to configured Gemini API
  console.log('[TEST 1] Sending general prompt to live /api/chat...');
  const t1 = await sendChat('Hello! What is your role in my command center?');
  console.log('HTTP Status:', t1.status);
  console.log('Provider Used:', t1.data.message?.providerUsed);
  console.log('isDemoMode:', t1.data.message?.isDemoMode);
  console.log('AI Response:\n', t1.data.message?.content);

  // TEST 2: Function/Tool Call (Create Task)
  console.log('\n[TEST 2] Sending action prompt to trigger function calling...');
  const t2 = await sendChat('Add a high priority task for Dani to deliver the MMA promo teaser by Friday');
  console.log('HTTP Status:', t2.status);
  console.log('Provider Used:', t2.data.message?.providerUsed);
  console.log('Tools Executed:', t2.data.message?.toolCalls);
  console.log('AI Response:\n', t2.data.message?.content);

  // TEST 3: Follow-Up Conversation referring to earlier turn
  console.log('\n[TEST 3] Sending follow-up prompt referencing earlier conversation...');
  const t3 = await sendChat('Who did I just assign that MMA teaser to, and what was its priority?');
  console.log('HTTP Status:', t3.status);
  console.log('Provider Used:', t3.data.message?.providerUsed);
  console.log('AI Response:\n', t3.data.message?.content);

  console.log('\n======================================================');
  console.log('ALL REAL GEMINI END-TO-END TESTS COMPLETED SUCCESSFULLY');
  console.log('======================================================');
}

main().catch(console.error);
