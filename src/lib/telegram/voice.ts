/**
 * Telegram Voice & Audio Processing Module
 * Handles secure audio download from Telegram Bot API and speech transcription
 * using Google Gemini's native multimodal audio capabilities.
 */

export interface AudioMessageInfo {
  fileId: string;
  mimeType: string;
  fileSize?: number;
  duration?: number;
  type: "voice" | "audio" | "audio_document";
  fileName?: string;
}

const MAX_AUDIO_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB Telegram Bot API download limit

/**
 * Detects and extracts voice note or audio attachment metadata from a Telegram message object.
 */
export function extractAudioInfo(message: any): AudioMessageInfo | null {
  if (!message || typeof message !== "object") return null;

  // 1. Direct Telegram voice note (.ogg / opus)
  if (message.voice && typeof message.voice.file_id === "string") {
    return {
      fileId: message.voice.file_id,
      mimeType: message.voice.mime_type || "audio/ogg",
      fileSize: message.voice.file_size,
      duration: message.voice.duration,
      type: "voice",
    };
  }

  // 2. Audio file attachment (.mp3, .m4a, .wav, etc.)
  if (message.audio && typeof message.audio.file_id === "string") {
    return {
      fileId: message.audio.file_id,
      mimeType: message.audio.mime_type || "audio/mpeg",
      fileSize: message.audio.file_size,
      duration: message.audio.duration,
      type: "audio",
      fileName: message.audio.file_name,
    };
  }

  // 3. Document attachment with audio MIME type
  if (
    message.document &&
    typeof message.document.file_id === "string" &&
    typeof message.document.mime_type === "string" &&
    message.document.mime_type.startsWith("audio/")
  ) {
    return {
      fileId: message.document.file_id,
      mimeType: message.document.mime_type,
      fileSize: message.document.file_size,
      type: "audio_document",
      fileName: message.document.file_name,
    };
  }

  return null;
}

/**
 * Downloads audio file bytes securely from Telegram Bot API using file_id.
 * Enforces size limits and never leaks the bot token.
 */
export async function downloadTelegramAudio(
  botToken: string,
  fileId: string,
  maxSizeBytes: number = MAX_AUDIO_SIZE_BYTES
): Promise<{ success: boolean; buffer?: Buffer; mimeType?: string; error?: string }> {
  if (!botToken) {
    return { success: false, error: "Telegram bot token is not configured." };
  }
  if (!fileId) {
    return { success: false, error: "No file_id provided." };
  }

  try {
    // Step 1: Query getFile to retrieve the relative file_path on Telegram servers
    const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
    const fileRes = await fetch(getFileUrl);
    if (!fileRes.ok) {
      return { success: false, error: `Telegram getFile request failed with status ${fileRes.status}` };
    }

    const fileJson = await fileRes.json();
    if (!fileJson.ok || !fileJson.result?.file_path) {
      return {
        success: false,
        error: fileJson.description || "Telegram could not locate file path.",
      };
    }

    const { file_path, file_size } = fileJson.result;

    // Check size limit before downloading
    if (file_size && file_size > maxSizeBytes) {
      return {
        success: false,
        error: `Audio file size (${Math.round(file_size / (1024 * 1024))}MB) exceeds the 20MB limit.`,
      };
    }

    // Step 2: Download raw audio stream
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${file_path}`;
    const downloadRes = await fetch(downloadUrl);
    if (!downloadRes.ok) {
      return { success: false, error: `Failed to download audio file from Telegram (${downloadRes.status})` };
    }

    const arrayBuf = await downloadRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    if (buffer.length > maxSizeBytes) {
      return {
        success: false,
        error: `Audio file size (${Math.round(buffer.length / (1024 * 1024))}MB) exceeds the 20MB limit.`,
      };
    }

    // Determine MIME type based on extension if needed
    let mimeType = "audio/ogg";
    if (file_path.endsWith(".mp3")) mimeType = "audio/mpeg";
    else if (file_path.endsWith(".m4a")) mimeType = "audio/mp4";
    else if (file_path.endsWith(".wav")) mimeType = "audio/wav";
    else if (file_path.endsWith(".oga") || file_path.endsWith(".ogg")) mimeType = "audio/ogg";

    return { success: true, buffer, mimeType };
  } catch (err: any) {
    return { success: false, error: `Audio download network error: ${err.message}` };
  }
}

/**
 * Transcribes audio buffer using Gemini's native multimodal audio model.
 * Injected with domain-specific vocabulary for Abbay TV, Ethiopian team names, and workspaces.
 */
export async function transcribeTelegramAudio(
  audioBuffer: Buffer,
  mimeType: string,
  apiKey: string,
  options?: {
    model?: string;
  }
): Promise<{ success: boolean; text?: string; unintelligible?: boolean; error?: string }> {
  if (!apiKey) {
    return { success: false, error: "GEMINI_API_KEY is not configured for transcription." };
  }
  if (!audioBuffer || audioBuffer.length === 0) {
    return { success: false, error: "Audio buffer is empty." };
  }

  // Prefer gemini-flash-latest for multimodal audio, with fallback to gemini-3.5-flash-lite
  const selectedModel = options?.model || process.env.GEMINI_AUDIO_MODEL || "gemini-flash-latest";
  const base64Audio = audioBuffer.toString("base64");

  const domainPrompt = `You are a precise, verbatim speech-to-text transcription engine for Abbay's Personal AI Command Center.
Abbay is the Graphics Department Lead at Abbay TV in Addis Ababa, Ethiopia (Africa/Addis_Ababa timezone).

Domain Vocabulary & Names:
- Team Members: Dani (lead motion designer), Sura (3D/broadcast artist), Simon (video editor), Kiru (motion designer), Bereket, Abbay.
- Workspaces: Abbay TV (broadcast graphics, promos, lower thirds, L-shapes, media packs), Client Work, Personal Projects.
- Projects & Clients: MMA, EthioTelecom, DaVinci Resolve Masterclass.
- Technical Deliverables: Promo, Teaser, Advert, Lower Third, L-Shape, Media Pack, Thumbnail, Premiere, DaVinci.

Instructions:
1. Transcribe the spoken audio verbatim in English or the spoken language.
2. Correct common phonetic approximations of known team names (e.g. "Danny" -> "Dani", "Surafel" -> "Sura", "Kirubel" -> "Kiru").
3. Output ONLY the raw transcription text. Do NOT wrap in quotes, do NOT add timestamps, headers, punctuation labels, or conversational filler.
4. If the audio contains NO speech, silence, background music without words, steady beeps, or is completely unintelligible, respond with EXACTLY: [UNINTELLIGIBLE]`;

  const modelsToTry = [selectedModel, "gemini-3.5-flash-lite"];

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: domainPrompt },
                {
                  inline_data: {
                    mime_type: mimeType || "audio/ogg",
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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`Transcription attempt with ${model} returned HTTP ${response.status}:`, errText.slice(0, 150));
        continue; // Try next model
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      if (!text || text === "[UNINTELLIGIBLE]" || text.toLowerCase().includes("[unintelligible]")) {
        return {
          success: false,
          unintelligible: true,
          error: "Could not detect clear speech in the voice note.",
        };
      }

      // Clean up stray quotes or markdown
      const cleaned = text.replace(/^["'`]+|["'`]+$/g, "").trim();
      return { success: true, text: cleaned };
    } catch (err: any) {
      console.warn(`Transcription attempt with ${model} exception:`, err.message);
      continue;
    }
  }

  return {
    success: false,
    error: "Speech transcription service is currently unavailable. Please send a text message.",
  };
}
