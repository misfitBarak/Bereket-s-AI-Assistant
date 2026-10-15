/**
 * Telegram Long-Polling Local Runner
 * Allows testing your Telegram bot directly on localhost:3000 without needing public tunnels.
 *
 * Usage:
 *   node scripts/telegram_poll.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function sanitizeTelegramToken(raw) {
  if (!raw) return '';
  const trimmed = raw.trim();
  const match = trimmed.match(/\b(\d{8,12}:[A-Za-z0-9_-]{30,50})\b/);
  if (match) return match[1];
  if (trimmed.startsWith('bot') && trimmed.includes(':')) {
    return trimmed.substring(3);
  }
  return trimmed;
}

async function getCredentials() {
  const dbSettings = await prisma.appSetting.findMany();
  const settingsMap = new Map(dbSettings.map((s) => [s.key, s.value]));

  const rawToken = settingsMap.get('TELEGRAM_BOT_TOKEN') || process.env.TELEGRAM_BOT_TOKEN;
  const token = sanitizeTelegramToken(rawToken);
  const allowedUser = settingsMap.get('TELEGRAM_ALLOWED_USER_ID') || process.env.TELEGRAM_ALLOWED_USER_ID;
  const webhookSecret = settingsMap.get('TELEGRAM_WEBHOOK_SECRET') || process.env.TELEGRAM_WEBHOOK_SECRET || '';

  return { token, allowedUser, webhookSecret };
}

async function startPolling() {
  console.log('====================================================');
  console.log('ABBAY AI COMMAND CENTER — TELEGRAM LOCAL POLLING');
  console.log('====================================================\n');

  const { token, allowedUser, webhookSecret } = await getCredentials();

  if (!token) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN is not configured.');
    console.error('Configure it in your .env file or in the Settings & AI tab in your browser.\n');
    process.exit(1);
  }

  console.log('✓ Telegram Token loaded from secure store.');
  console.log(`✓ Allowed User ID: ${allowedUser || 'Not set (will reject all messages by default)'}`);

  // Test getMe to confirm bot identity
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = await meRes.json();
    if (!meData.ok) {
      console.error(`❌ Telegram getMe failed: ${meData.description}`);
      process.exit(1);
    }
    console.log(`✓ Connected to Telegram Bot: @${meData.result.username} (${meData.result.first_name})`);
    console.log(`✓ Polling for updates... Send a message to @${meData.result.username} on Telegram!\n`);
  } catch (err) {
    console.error('❌ Failed to connect to Telegram API:', err.message);
    process.exit(1);
  }

  let offset = 0;
  let lastSchedulerTick = 0;

  while (true) {
    // Check and execute due scheduled messages every 15 seconds
    if (Date.now() - lastSchedulerTick > 15000) {
      lastSchedulerTick = Date.now();
      fetch('http://localhost:3000/api/scheduler/tick', { method: 'POST' })
        .then((r) => r.json())
        .then((d) => {
          if (d.executed > 0) {
            console.log(`[Scheduler Worker] Executed ${d.executed} due scheduled message(s)`);
          }
        })
        .catch(() => {});
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), 20000);

    try {
      // 12-second long polling timeout to fit safely inside Node.js fetch keep-alive windows
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=12`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutHandle);

      if (!res.ok) {
        console.error(`getUpdates HTTP ${res.status}:`, await res.text());
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      const data = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          const fromId = update.message?.from?.id;
          const fromName = update.message?.from?.first_name || 'User';
          let msgDesc = update.message?.text ? `"${update.message.text}"` : '(non-text)';
          if (update.message?.voice) {
            msgDesc = `[Voice Note: ${update.message.voice.duration}s, ${Math.round((update.message.voice.file_size || 0) / 1024)}KB]`;
          } else if (update.message?.audio) {
            msgDesc = `[Audio File: ${update.message.audio.file_name || 'audio'}, ${update.message.audio.duration}s]`;
          }

          console.log(`\n[Telegram Update #${update.update_id}] From: ${fromName} (${fromId})`);
          console.log(`Incoming: ${msgDesc}`);

          // Forward update to the local webhook endpoint on localhost:3000
          try {
            const webhookRes = await fetch('http://localhost:3000/api/telegram/webhook', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Bot-Api-Secret-Token': webhookSecret,
              },
              body: JSON.stringify(update),
            });
            const webhookJson = await webhookRes.json();
            console.log(`Command Center status: ${webhookJson.status} | Handled: ${webhookJson.handled}`);
          } catch (forwardErr) {
            console.error('Failed to forward to localhost:3000/api/telegram/webhook:', forwardErr.message);
          }
        }
      }
    } catch (e) {
      clearTimeout(timeoutHandle);
      if (e.name === 'AbortError') {
        // Expected timeout when no updates; simply loop cleanly
        continue;
      }
      console.warn('Transient polling network notice:', e.message);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

startPolling().catch(console.error);
