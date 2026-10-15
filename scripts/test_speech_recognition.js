const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSpeech() {
  const wavPath = path.join(__dirname, 'test_speech.wav');

  // Generate speech WAV using PowerShell SAPI
  console.log('Generating sample speech WAV with Windows TTS...');
  try {
    const psCmd = `powershell -Command "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('${wavPath.replace(/\\/g, '\\\\')}'); $s.Speak('What tasks is Dani working on?'); $s.Dispose();"`;
    execSync(psCmd, { stdio: 'inherit' });
    console.log(`✓ Generated speech WAV (${fs.statSync(wavPath).size} bytes)`);
  } catch (err) {
    console.warn('TTS generation failed:', err.message);
    return;
  }

  const audioBuffer = fs.readFileSync(wavPath);
  const base64Audio = audioBuffer.toString('base64');

  const dbSettings = await prisma.appSetting.findMany();
  const settingsMap = new Map(dbSettings.map((s) => [s.key, s.value]));
  const geminiKey = settingsMap.get('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;

  const prompt = `You are a precise speech-to-text transcription engine for Abbay's Personal AI Command Center.
Abbay is the Graphics Department Lead at Abbay TV in Addis Ababa, Ethiopia.
Key team members: Dani, Sura, Simon, Kiru, Bereket, Abbay.
Workspaces & Projects: Abbay TV, Client Work, MMA, EthioTelecom, DaVinci Masterclass.

Transcribe the spoken audio verbatim.
Correct phonetic approximations of known team names (e.g. "Danny" -> "Dani", "Surafel" -> "Sura").
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
  console.log('Full Gemini response:', JSON.stringify(data, null, 2));

  // Clean up
  if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
}

testSpeech()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
