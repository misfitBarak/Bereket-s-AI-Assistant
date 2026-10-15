import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Check environment variables and AppSettings
    const dbSettings = await db.appSetting.findMany();
    const settingsMap = new Map(dbSettings.map((s) => [s.key, s.value]));

    const activeProvider = settingsMap.get("AI_PROVIDER") || process.env.AI_PROVIDER || "auto";
    const hasGeminiKey = Boolean(settingsMap.get("GEMINI_API_KEY") || process.env.GEMINI_API_KEY);
    const hasOpenAIKey = Boolean(settingsMap.get("OPENAI_API_KEY") || process.env.OPENAI_API_KEY);
    const hasAnthropicKey = Boolean(settingsMap.get("ANTHROPIC_API_KEY") || process.env.ANTHROPIC_API_KEY);
    const hasGroqKey = Boolean(settingsMap.get("GROQ_API_KEY") || process.env.GROQ_API_KEY);
    const ollamaBaseUrl = settingsMap.get("OLLAMA_BASE_URL") || process.env.OLLAMA_BASE_URL || "http://localhost:11434";

    let activeProviderName = "Built-in Autonomous Engine (Demo Mode)";
    let isDemoMode = true;

    if (activeProvider === "gemini" && hasGeminiKey) {
      const currentGeminiModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
      activeProviderName = `Google Gemini (${currentGeminiModel})`;
      isDemoMode = false;
    } else if (activeProvider === "openai" && hasOpenAIKey) {
      activeProviderName = "OpenAI (GPT-4o)";
      isDemoMode = false;
    } else if (activeProvider === "anthropic" && hasAnthropicKey) {
      activeProviderName = "Anthropic Claude (Claude 3.5 Sonnet)";
      isDemoMode = false;
    } else if (activeProvider === "groq" && hasGroqKey) {
      activeProviderName = "Groq High-Speed Llama 3";
      isDemoMode = false;
    } else if (activeProvider === "auto") {
      if (hasGeminiKey) {
        activeProviderName = "Google Gemini (Auto-detected)";
        isDemoMode = false;
      } else if (hasOpenAIKey) {
        activeProviderName = "OpenAI (Auto-detected)";
        isDemoMode = false;
      } else if (hasGroqKey) {
        activeProviderName = "Groq (Auto-detected)";
        isDemoMode = false;
      } else if (hasAnthropicKey) {
        activeProviderName = "Anthropic Claude (Auto-detected)";
        isDemoMode = false;
      }
    }

    const hasTelegramToken = Boolean(settingsMap.get("TELEGRAM_BOT_TOKEN") || process.env.TELEGRAM_BOT_TOKEN);
    const hasTelegramAllowedUser = Boolean(
      settingsMap.get("TELEGRAM_ALLOWED_USER_ID") || process.env.TELEGRAM_ALLOWED_USER_ID
    );
    const hasTelegramWebhookSecret = Boolean(
      settingsMap.get("TELEGRAM_WEBHOOK_SECRET") || process.env.TELEGRAM_WEBHOOK_SECRET
    );

    const { getPersonalAccountStatus } = await import("@/lib/telegram/personalClient");
    const personalStatus = await getPersonalAccountStatus();

    return NextResponse.json({
      success: true,
      config: {
        provider: activeProvider,
        activeProviderName,
        isDemoMode,
        hasGeminiKey,
        hasOpenAIKey,
        hasAnthropicKey,
        hasGroqKey,
        ollamaBaseUrl,
        telegram: {
          configured: hasTelegramToken && hasTelegramAllowedUser,
          hasToken: hasTelegramToken,
          hasAllowedUser: hasTelegramAllowedUser,
          hasWebhookSecret: hasTelegramWebhookSecret,
          webhookEndpoint: "/api/telegram/webhook",
        },
        telegramPersonal: {
          isConfigured: personalStatus.isConfigured,
          isConnected: personalStatus.isConnected,
          user: personalStatus.user,
          error: personalStatus.error,
        },
      },
    });
  } catch (error: any) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      provider,
      geminiKey,
      openAIKey,
      anthropicKey,
      groqKey,
      ollamaBaseUrl,
      telegramToken,
      telegramAllowedUserId,
      telegramWebhookSecret,
      telegramPersonalApiId,
      telegramPersonalApiHash,
      telegramContactAliases,
    } = body;

    const upsertSetting = async (key: string, value: string | undefined) => {
      if (value !== undefined) {
        await db.appSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
      }
    };

    if (provider) await upsertSetting("AI_PROVIDER", provider);
    if (geminiKey !== undefined) await upsertSetting("GEMINI_API_KEY", geminiKey);
    if (openAIKey !== undefined) await upsertSetting("OPENAI_API_KEY", openAIKey);
    if (anthropicKey !== undefined) await upsertSetting("ANTHROPIC_API_KEY", anthropicKey);
    if (groqKey !== undefined) await upsertSetting("GROQ_API_KEY", groqKey);
    if (ollamaBaseUrl !== undefined) await upsertSetting("OLLAMA_BASE_URL", ollamaBaseUrl);
    if (telegramToken !== undefined) await upsertSetting("TELEGRAM_BOT_TOKEN", telegramToken);
    if (telegramAllowedUserId !== undefined) await upsertSetting("TELEGRAM_ALLOWED_USER_ID", telegramAllowedUserId);
    if (telegramWebhookSecret !== undefined) await upsertSetting("TELEGRAM_WEBHOOK_SECRET", telegramWebhookSecret);
    if (telegramPersonalApiId !== undefined) await upsertSetting("TELEGRAM_PERSONAL_API_ID", telegramPersonalApiId);
    if (telegramPersonalApiHash !== undefined) await upsertSetting("TELEGRAM_PERSONAL_API_HASH", telegramPersonalApiHash);
    if (telegramContactAliases !== undefined) await upsertSetting("TELEGRAM_CONTACT_ALIASES", typeof telegramContactAliases === "string" ? telegramContactAliases : JSON.stringify(telegramContactAliases));

    return NextResponse.json({ success: true, message: "Settings saved successfully" });
  } catch (error: any) {
    console.error("POST /api/settings error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
