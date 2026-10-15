const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const settings = await prisma.appSetting.findMany();
  const token = settings.find((s) => s.key === 'TELEGRAM_BOT_TOKEN')?.value;
  console.log('Token exists:', !!token);

  try {
    const res = await fetch(`https://api.telegram.org/bot${token.trim()}/getMe`);
    console.log('getMe status:', res.status);
    const data = await res.json();
    console.log('getMe ok:', data.ok, 'bot username:', data.result?.username);

    const updatesRes = await fetch(`https://api.telegram.org/bot${token.trim()}/getUpdates?limit=5`);
    console.log('getUpdates status:', updatesRes.status);
    const updatesData = await updatesRes.json();
    console.log('getUpdates ok:', updatesData.ok, 'updates count:', updatesData.result?.length);
    if (updatesData.result && updatesData.result.length > 0) {
      const last = updatesData.result[updatesData.result.length - 1];
      console.log('Last Telegram update ID:', last.update_id, 'from:', last.message?.from?.id, 'text:', last.message?.text);
    }
  } catch (err) {
    console.error('Fetch error:', err.message, err.cause);
  }
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
