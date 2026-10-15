const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function createMinimalWav() {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const numSamples = sampleRate; // 1 second
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 32767 * 0.5;
    buffer.writeInt16LE(Math.floor(sample), 44 + i * 2);
  }
  return buffer;
}

async function testTranscriptionPrompt() {
  const dbSettings = await prisma.appSetting.findMany();
  const settingsMap = new Map(dbSettings.map((s) => [s.key, s.value]));
  const geminiKey = settingsMap.get('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;

  const wavBuffer = createMinimalWav();
  const base64Audio = wavBuffer.toString('base64');

  const prompt = `You are a precise speech-to-text transcription engine.
Transcribe the spoken audio verbatim.
Output ONLY the raw transcription without any quotes, timestamps, commentary, or markdown.
If the audio contains no speech, silence, beeps, tones, music without vocals, or is completely unintelligible, respond with EXACTLY: [UNINTELLIGIBLE]`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'audio/wav',
                data: base64Audio,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.0,
      },
    }),
  });

  const data = await res.json();
  const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  console.log('Result on tone audio:', result);
}

testTranscriptionPrompt()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
