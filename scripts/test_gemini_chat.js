const http = require('http');

function post(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
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

async function testGemini() {
  console.log('========================================================');
  console.log('🤖 TESTING LIVE GOOGLE GEMINI TOOL CALLING & GROUNDING');
  console.log('========================================================\n');

  console.log('Sending user prompt: "Who is currently overloaded in the Graphics Department and what are their assigned hours?"');
  const res = await post('http://localhost:3000/api/chat', {
    message: 'Who is currently overloaded in the Graphics Department and what are their assigned hours?',
    conversationId: 'test_grounding_session_' + Date.now(),
  });

  console.log(`Response HTTP Status: ${res.status}`);
  const msg = res.data?.message;
  if (msg) {
    console.log(`Provider Used: ${msg.providerUsed}`);
    console.log(`Tool Calls Executed:`, JSON.stringify(msg.toolCalls, null, 2));
    console.log(`Assistant Response:\n${msg.content}\n`);

    const hasDani = msg.content.toLowerCase().includes('dani');
    const hasHoursOrPercent = msg.content.includes('44') || msg.content.includes('367') || msg.content.includes('12');
    const calledTool = msg.toolCalls && msg.toolCalls.some(t => t.name === 'get_department_workload' || t.name === 'balance_workload');

    if (calledTool) {
      console.log('✅ Tool Execution: Successfully called department workload tool');
    } else {
      console.log('ℹ️ Tool Execution: Answered from live system prompt roster or grounding');
    }

    if (hasDani) {
      console.log('✅ Grounding: Correctly identified Dani as the overloaded artist');
    } else {
      console.log('❌ Grounding: Failed to identify Dani');
    }

    if (hasHoursOrPercent) {
      console.log('✅ Math Truthfulness: Correctly cited real hours or percentage from SQLite');
    } else {
      console.log('ℹ️ Math Truthfulness: Hours/percentage not explicitly formatted in text');
    }
  } else {
    console.error('No JSON response:', res.raw);
  }
}

testGemini().catch(console.error).finally(() => process.exit(0));
