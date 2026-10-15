const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Generate a valid minimal 1-second 8kHz mono 16-bit PCM WAV file
function createMinimalWav() {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const numSamples = sampleRate; // 1 second
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // generate 440 Hz tone
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 32767 * 0.5;
    buffer.writeInt16LE(Math.floor(sample), 44 + i * 2);
  }

  return buffer;
}

async function testAudioInput() {
  const dbSettings = await prisma.appSetting.findMany();
  const settingsMap = new Map(dbSettings.map((s) => [s.key, s.value]));
  const geminiKey = settingsMap.get('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;

  const wavBuffer = createMinimalWav();
  const base64Audio = wavBuffer.toString('base64');
  console.log(`Generated test WAV buffer: ${wavBuffer.length} bytes`);

  const modelsToTest = [
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash-lite',
  ];

  for (const model of modelsToTest) {
    console.log(`\nTesting audio inline_data with model: ${model}`);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: 'Describe what you hear in this audio. If it is a tone or silence, state that clearly.',
                },
                {
                  inline_data: {
                    mime_type: 'audio/wav',
                    data: base64Audio,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        console.error(`HTTP ${res.status}:`, await res.text());
      } else {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log(`✓ Response from ${model}:`, text);
      }
    } catch (e) {
      console.error(`Error with ${model}:`, e.message);
    }
  }
}

testAudioInput()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
