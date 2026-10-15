const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnose() {
  const dbSettings = await prisma.appSetting.findMany();
  const settingsMap = new Map(dbSettings.map((s) => [s.key, s.value]));

  const geminiKey = settingsMap.get('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
  const currentModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

  console.log(`Gemini Key configured: ${geminiKey ? 'YES (length ' + geminiKey.length + ')' : 'NO'}`);
  console.log(`Default model configured: ${currentModel}`);

  if (!geminiKey) {
    console.error('No Gemini Key found.');
    return;
  }

  // List models
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
    const listData = await listRes.json();
    if (listData.models) {
      console.log(`Total models available: ${listData.models.length}`);
      const flashModels = listData.models
        .filter((m) => m.name.includes('flash') || m.name.includes('gemini'))
        .map((m) => ({
          name: m.name,
          supportedGenerationMethods: m.supportedGenerationMethods,
        }));
      console.log('Sample Gemini models:');
      flashModels.slice(0, 10).forEach((m) => {
        console.log(` - ${m.name} (${m.supportedGenerationMethods?.join(', ')})`);
      });
    } else {
      console.log('List models response:', listData);
    }
  } catch (err) {
    console.error('List models error:', err.message);
  }

  // Test simple generation
  try {
    const genRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with: PONG' }] }],
        }),
      }
    );
    const genData = await genRes.json();
    console.log(`Current model ${currentModel} test response:`);
    console.log(genData.candidates?.[0]?.content?.parts?.[0]?.text || genData);
  } catch (err) {
    console.error('Gen error:', err.message);
  }
}

diagnose()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
