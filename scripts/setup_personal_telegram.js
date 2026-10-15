/**
 * Abbay AI Command Center — Personal Telegram Account Setup CLI
 * 
 * Secure terminal workflow to authenticate your personal Telegram account
 * via GramJS without exposing API credentials, phone numbers, login codes,
 * or session strings to chat logs.
 * 
 * Usage: node scripts/setup_personal_telegram.js
 */

const readline = require('readline');
const { PrismaClient } = require('@prisma/client');
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');

const prisma = new PrismaClient();

function askQuestion(query, hidden = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (!hidden) {
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    } else {
      process.stdout.write(query);
      let input = '';
      const onData = (char) => {
        char = char.toString();
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004':
            process.stdin.removeListener('data', onData);
            process.stdin.setRawMode(false);
            process.stdout.write('\n');
            rl.close();
            resolve(input.trim());
            break;
          case '\u0003': // Ctrl+C
            process.exit(1);
            break;
          case '\u0008': // Backspace
          case '\x7f':
            if (input.length > 0) {
              input = input.slice(0, -1);
              process.stdout.write('\b \b');
            }
            break;
          default:
            input += char;
            process.stdout.write('*');
            break;
        }
      };

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      process.stdin.on('data', onData);
    }
  });
}

async function runSetup() {
  console.log('===============================================================');
  console.log('🔒 ABBAY AI COMMAND CENTER — PERSONAL TELEGRAM ACCOUNT SETUP');
  console.log('===============================================================\n');
  console.log('This tool will connect your personal Telegram account directly to');
  console.log('your local database. Credentials and sessions are saved locally.\n');
  console.log('You will need:');
  console.log('1. Telegram API ID and API HASH (from https://my.telegram.org)');
  console.log('2. Your phone number in international format (+251...)');
  console.log('3. The verification code sent to your Telegram app.\n');

  // Check existing credentials in AppSetting
  const dbSettings = await prisma.appSetting.findMany({
    where: {
      key: { in: ['TELEGRAM_PERSONAL_API_ID', 'TELEGRAM_PERSONAL_API_HASH', 'TELEGRAM_PERSONAL_SESSION'] },
    },
  });
  const settingsMap = new Map(dbSettings.map((s) => [s.key, s.value]));

  let apiId = settingsMap.get('TELEGRAM_PERSONAL_API_ID') || process.env.TELEGRAM_PERSONAL_API_ID;
  let apiHash = settingsMap.get('TELEGRAM_PERSONAL_API_HASH') || process.env.TELEGRAM_PERSONAL_API_HASH;
  const existingSession = settingsMap.get('TELEGRAM_PERSONAL_SESSION');

  if (existingSession) {
    console.log('⚠️  An existing personal Telegram session was found in your database.');
    const overwrite = await askQuestion('Do you want to re-authenticate and replace it? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup aborted. Existing session preserved.');
      await prisma.$disconnect();
      return;
    }
  }

  if (!apiId) {
    apiId = await askQuestion('Enter your Telegram API ID: ');
  } else {
    console.log(`Using existing API ID: ${apiId}`);
  }

  if (!apiHash) {
    apiHash = await askQuestion('Enter your Telegram API HASH: ');
  } else {
    console.log(`Using existing API HASH: [configured]`);
  }

  const numApiId = parseInt(apiId, 10);
  if (isNaN(numApiId) || !apiHash) {
    console.error('❌ Error: Valid API ID and API HASH are required.');
    await prisma.$disconnect();
    return;
  }

  const phoneNumber = await askQuestion('Enter your phone number (e.g. +251911234567): ');
  if (!phoneNumber.startsWith('+') || phoneNumber.length < 8) {
    console.error('❌ Error: Phone number must include country code (+...)');
    await prisma.$disconnect();
    return;
  }

  console.log('\nConnecting to Telegram MTProto servers...');
  const stringSession = new StringSession('');
  const client = new TelegramClient(stringSession, numApiId, apiHash, {
    connectionRetries: 3,
  });

  await client.connect();

  console.log(`Sending authentication code to ${phoneNumber.replace(/(\+\d{3})\d+(\d{2})/, '$1****$2')}...`);
  const { phoneCodeHash } = await client.sendCode(
    {
      apiId: numApiId,
      apiHash,
    },
    phoneNumber
  );

  console.log('✓ Code sent! Check your Telegram app for the verification code.\n');
  const code = await askQuestion('Enter the verification code you received: ');

  try {
    await client.invoke(
      new Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash,
        phoneCode: code.trim(),
      })
    );
  } catch (err) {
    if (err.message && err.message.includes('SESSION_PASSWORD_NEEDED')) {
      console.log('\n🔒 Two-Step Verification (2FA) is enabled on your account.');
      const password = await askQuestion('Enter your 2FA password: ', true);
      await client.signInWithPassword(
        {
          apiId: numApiId,
          apiHash,
        },
        {
          password: async () => password,
          onError: (e) => {
            throw e;
          },
        }
      );
    } else {
      console.error('❌ Authentication failed:', err.message);
      await client.disconnect();
      await prisma.$disconnect();
      return;
    }
  }

  const sessionString = client.session.save();
  const me = await client.getMe();
  const userName = `${me.firstName || ''} ${me.lastName || ''}`.trim();
  const username = me.username ? `@${me.username}` : '[no username]';

  // Save to database
  await prisma.appSetting.upsert({
    where: { key: 'TELEGRAM_PERSONAL_API_ID' },
    create: { key: 'TELEGRAM_PERSONAL_API_ID', value: numApiId.toString() },
    update: { value: numApiId.toString() },
  });
  await prisma.appSetting.upsert({
    where: { key: 'TELEGRAM_PERSONAL_API_HASH' },
    create: { key: 'TELEGRAM_PERSONAL_API_HASH', value: apiHash },
    update: { value: apiHash },
  });
  await prisma.appSetting.upsert({
    where: { key: 'TELEGRAM_PERSONAL_SESSION' },
    create: { key: 'TELEGRAM_PERSONAL_SESSION', value: sessionString },
    update: { value: sessionString },
  });
  await prisma.appSetting.upsert({
    where: { key: 'TELEGRAM_PERSONAL_USER_INFO' },
    create: {
      key: 'TELEGRAM_PERSONAL_USER_INFO',
      value: JSON.stringify({
        id: me.id ? me.id.toString() : '',
        firstName: me.firstName || '',
        lastName: me.lastName || undefined,
        username: me.username || undefined,
        phone: phoneNumber,
      }),
    },
    update: {
      value: JSON.stringify({
        id: me.id ? me.id.toString() : '',
        firstName: me.firstName || '',
        lastName: me.lastName || undefined,
        username: me.username || undefined,
        phone: phoneNumber,
      }),
    },
  });

  console.log('\n===============================================================');
  console.log('🎉 SUCCESS: PERSONAL TELEGRAM ACCOUNT AUTHENTICATED!');
  console.log(`   Account: ${userName} (${username})`);
  console.log(`   Phone:   ${phoneNumber.replace(/(\+\d{3})\d+(\d{2})/, '$1****$2')}`);
  console.log('   Session: Saved securely in SQLite database');
  console.log('===============================================================\n');

  await client.disconnect();
  await prisma.$disconnect();
}

runSetup().catch((err) => {
  console.error('Fatal setup error:', err);
  process.exit(1);
});
