import { db } from "../db";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";

export interface PersonalTelegramUser {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  phone?: string;
}

export interface PersonalAccountStatus {
  isConfigured: boolean;
  isConnected: boolean;
  user: PersonalTelegramUser | null;
  error?: string;
}

export interface PersonalContactItem {
  id: string;
  name: string;
  username?: string;
  phone?: string;
  isUser: boolean;
  isGroup: boolean;
  isChannel: boolean;
  lastMessageSnippet?: string;
  unreadCount?: number;
}

export interface PersonalMessageItem {
  id: number;
  text: string;
  isOutgoing: boolean;
  senderName: string;
  timestamp: string; // ISO string
}

export interface ResolveRecipientResult {
  resolved: boolean;
  peer?: PersonalContactItem;
  isAmbiguous?: boolean;
  candidates?: PersonalContactItem[];
  error?: string;
}

// In-memory active client singleton
let clientInstance: TelegramClient | null = null;
let clientConnectingPromise: Promise<TelegramClient | null> | null = null;

// Temporary storage for in-flight 2FA / code authentication flows (15-min TTL)
interface PendingAuthFlow {
  client: TelegramClient;
  apiId: number;
  apiHash: string;
  phoneNumber: string;
  phoneCodeHash: string;
  createdAt: number;
}
let activeAuthFlow: PendingAuthFlow | null = null;

// Mock adapter for automated unit & integration testing
let mockAdapter: {
  getStatus?: () => Promise<PersonalAccountStatus>;
  getContacts?: () => Promise<PersonalContactItem[]>;
  getMessages?: (peer: string, limit: number) => Promise<PersonalMessageItem[]>;
  sendMessage?: (peer: string, text: string) => Promise<{ success: boolean; messageId: number }>;
} | null = null;

export function setPersonalClientMock(adapter: typeof mockAdapter) {
  mockAdapter = adapter;
}

export function clearPersonalClientMock() {
  mockAdapter = null;
}

/**
 * Retrieves API ID, API HASH, and Session from database AppSettings or process.env.
 */
export async function getPersonalCredentials() {
  const dbSettings = await db.appSetting.findMany({
    where: {
      key: {
        in: [
          "TELEGRAM_PERSONAL_API_ID",
          "TELEGRAM_PERSONAL_API_HASH",
          "TELEGRAM_PERSONAL_SESSION",
          "TELEGRAM_PERSONAL_USER_INFO",
          "TELEGRAM_CONTACT_ALIASES",
        ],
      },
    },
  });

  const settingsMap = new Map(dbSettings.map((s) => [s.key, s.value]));

  const rawApiId = settingsMap.get("TELEGRAM_PERSONAL_API_ID") || process.env.TELEGRAM_PERSONAL_API_ID || "";
  const apiId = parseInt(rawApiId, 10);
  const apiHash = settingsMap.get("TELEGRAM_PERSONAL_API_HASH") || process.env.TELEGRAM_PERSONAL_API_HASH || "";
  const sessionString = settingsMap.get("TELEGRAM_PERSONAL_SESSION") || process.env.TELEGRAM_PERSONAL_SESSION || "";
  const userInfoRaw = settingsMap.get("TELEGRAM_PERSONAL_USER_INFO") || "";
  const contactAliasesRaw = settingsMap.get("TELEGRAM_CONTACT_ALIASES") || "{}";

  let savedUser: PersonalTelegramUser | null = null;
  if (userInfoRaw) {
    try {
      savedUser = JSON.parse(userInfoRaw);
    } catch {
      savedUser = null;
    }
  }

  let contactAliases: Record<string, string> = {};
  if (contactAliasesRaw) {
    try {
      contactAliases = JSON.parse(contactAliasesRaw);
    } catch {
      contactAliases = {};
    }
  }

  return {
    apiId: isNaN(apiId) ? 0 : apiId,
    apiHash,
    sessionString,
    savedUser,
    contactAliases,
  };
}

/**
 * Gets or connects the authenticated personal GramJS TelegramClient.
 * Returns null if not configured or session is invalid.
 */
export async function getPersonalTelegramClient(): Promise<TelegramClient | null> {
  if (mockAdapter) return null;

  if (clientInstance && clientInstance.connected) {
    return clientInstance;
  }

  if (clientConnectingPromise) {
    return clientConnectingPromise;
  }

  clientConnectingPromise = (async () => {
    try {
      const { apiId, apiHash, sessionString } = await getPersonalCredentials();

      if (!apiId || !apiHash || !sessionString) {
        return null;
      }

      const stringSession = new StringSession(sessionString);
      const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 3,
        autoReconnect: true,
      });

      await client.connect();

      // Verify session is valid
      const isAuth = await client.checkAuthorization();
      if (!isAuth) {
        console.warn("Personal Telegram session is invalid or expired.");
        await client.disconnect();
        return null;
      }

      clientInstance = client;
      return client;
    } catch (err: any) {
      console.error("Failed to connect personal Telegram client:", err.message);
      return null;
    } finally {
      clientConnectingPromise = null;
    }
  })();

  return clientConnectingPromise;
}

/**
 * Returns the current health and connection status of the personal Telegram account.
 */
export async function getPersonalAccountStatus(): Promise<PersonalAccountStatus> {
  if (mockAdapter?.getStatus) {
    return mockAdapter.getStatus();
  }

  try {
    const { apiId, apiHash, sessionString, savedUser } = await getPersonalCredentials();
    const isConfigured = Boolean(apiId && apiHash && sessionString);

    if (!isConfigured) {
      return {
        isConfigured: false,
        isConnected: false,
        user: null,
      };
    }

    const client = await getPersonalTelegramClient();
    if (!client) {
      return {
        isConfigured: true,
        isConnected: false,
        user: savedUser,
        error: "Session exists but connection could not be established. Re-authentication may be required.",
      };
    }

    // Retrieve fresh live profile from Telegram
    const me = (await client.getMe()) as any;
    const user: PersonalTelegramUser = {
      id: me.id ? me.id.toString() : savedUser?.id || "",
      firstName: me.firstName || savedUser?.firstName || "",
      lastName: me.lastName || savedUser?.lastName || undefined,
      username: me.username || savedUser?.username || undefined,
      phone: me.phone ? `+${me.phone}` : savedUser?.phone || undefined,
    };

    // Update cached profile
    await db.appSetting.upsert({
      where: { key: "TELEGRAM_PERSONAL_USER_INFO" },
      create: { key: "TELEGRAM_PERSONAL_USER_INFO", value: JSON.stringify(user) },
      update: { value: JSON.stringify(user) },
    });

    return {
      isConfigured: true,
      isConnected: true,
      user,
    };
  } catch (err: any) {
    return {
      isConfigured: true,
      isConnected: false,
      user: null,
      error: err.message,
    };
  }
}

/**
 * Initiates personal account login by sending a Telegram authentication code.
 */
export async function startPersonalLogin(params: {
  phoneNumber: string;
  apiId?: number;
  apiHash?: string;
}): Promise<{
  success: boolean;
  phoneCodeHash?: string;
  isCodeViaApp?: boolean;
  error?: string;
}> {
  try {
    const creds = await getPersonalCredentials();
    const apiId = params.apiId || creds.apiId;
    const apiHash = params.apiHash || creds.apiHash;

    if (!apiId || !apiHash) {
      return {
        success: false,
        error: "API ID and API Hash are required. Obtain them from https://my.telegram.org",
      };
    }

    // Save API credentials in AppSettings
    await db.appSetting.upsert({
      where: { key: "TELEGRAM_PERSONAL_API_ID" },
      create: { key: "TELEGRAM_PERSONAL_API_ID", value: apiId.toString() },
      update: { value: apiId.toString() },
    });
    await db.appSetting.upsert({
      where: { key: "TELEGRAM_PERSONAL_API_HASH" },
      create: { key: "TELEGRAM_PERSONAL_API_HASH", value: apiHash },
      update: { value: apiHash },
    });

    const cleanPhone = params.phoneNumber.trim().replace(/[^\d+]/g, "");
    if (!cleanPhone.startsWith("+") || cleanPhone.length < 8) {
      return {
        success: false,
        error: "Phone number must be in international format with country code (e.g. +251911234567)",
      };
    }

    // Create fresh client session for auth
    const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
      connectionRetries: 3,
    });
    await client.connect();

    const res = await client.sendCode(
      {
        apiId,
        apiHash,
      },
      cleanPhone
    );

    // Save in-flight auth flow
    activeAuthFlow = {
      client,
      apiId,
      apiHash,
      phoneNumber: cleanPhone,
      phoneCodeHash: res.phoneCodeHash,
      createdAt: Date.now(),
    };

    return {
      success: true,
      phoneCodeHash: res.phoneCodeHash,
      isCodeViaApp: res.isCodeViaApp,
    };
  } catch (err: any) {
    console.error("Personal login initiation error:", err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Completes personal account login using the verification code (and 2FA password if enabled).
 */
export async function completePersonalLogin(params: {
  code: string;
  password?: string;
  phoneCodeHash?: string;
  phoneNumber?: string;
}): Promise<{
  success: boolean;
  user?: PersonalTelegramUser;
  error?: string;
  requiresPassword?: boolean;
}> {
  try {
    let client: TelegramClient;
    let phoneNumber: string;
    let phoneCodeHash: string;

    if (activeAuthFlow && Date.now() - activeAuthFlow.createdAt < 15 * 60 * 1000) {
      client = activeAuthFlow.client;
      phoneNumber = activeAuthFlow.phoneNumber;
      phoneCodeHash = activeAuthFlow.phoneCodeHash;
    } else {
      const creds = await getPersonalCredentials();
      if (!creds.apiId || !creds.apiHash || !params.phoneNumber || !params.phoneCodeHash) {
        return {
          success: false,
          error: "Auth session expired. Please restart the login process.",
        };
      }
      client = new TelegramClient(new StringSession(""), creds.apiId, creds.apiHash, {
        connectionRetries: 3,
      });
      await client.connect();
      phoneNumber = params.phoneNumber;
      phoneCodeHash = params.phoneCodeHash;
    }

    let userObj: any;
    try {
      userObj = await client.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash,
          phoneCode: params.code.trim(),
        })
      );
    } catch (signInErr: any) {
      if (signInErr.message.includes("SESSION_PASSWORD_NEEDED")) {
        if (!params.password) {
          return {
            success: false,
            requiresPassword: true,
            error: "Two-step verification is active on this account. Please provide your 2FA password.",
          };
        }
        // Handle 2FA Password
        userObj = await client.signInWithPassword(
          {
            apiId: activeAuthFlow?.apiId || (await getPersonalCredentials()).apiId,
            apiHash: activeAuthFlow?.apiHash || (await getPersonalCredentials()).apiHash,
          },
          {
            password: async () => params.password || "",
            onError: (e) => {
              throw e;
            },
          }
        );
      } else {
        throw signInErr;
      }
    }

    // Persist authenticated session string safely into AppSetting
    const sessionString = client.session.save() as unknown as string;
    await db.appSetting.upsert({
      where: { key: "TELEGRAM_PERSONAL_SESSION" },
      create: { key: "TELEGRAM_PERSONAL_SESSION", value: sessionString },
      update: { value: sessionString },
    });

    const me = (await client.getMe()) as any;
    const user: PersonalTelegramUser = {
      id: me.id ? me.id.toString() : "",
      firstName: me.firstName || "",
      lastName: me.lastName || undefined,
      username: me.username || undefined,
      phone: me.phone ? `+${me.phone}` : phoneNumber,
    };

    await db.appSetting.upsert({
      where: { key: "TELEGRAM_PERSONAL_USER_INFO" },
      create: { key: "TELEGRAM_PERSONAL_USER_INFO", value: JSON.stringify(user) },
      update: { value: JSON.stringify(user) },
    });

    clientInstance = client;
    activeAuthFlow = null;

    return {
      success: true,
      user,
    };
  } catch (err: any) {
    console.error("Personal login completion error:", err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Disconnects and revokes local session.
 */
export async function disconnectPersonalAccount(): Promise<{ success: boolean }> {
  try {
    if (clientInstance) {
      try {
        await clientInstance.disconnect();
      } catch {}
      clientInstance = null;
    }

    await db.appSetting.deleteMany({
      where: {
        key: { in: ["TELEGRAM_PERSONAL_SESSION", "TELEGRAM_PERSONAL_USER_INFO"] },
      },
    });

    activeAuthFlow = null;
    return { success: true };
  } catch (err: any) {
    return { success: false };
  }
}

/**
 * Retrieves contacts and recent dialogs from personal Telegram account.
 */
export async function getPersonalContacts(): Promise<PersonalContactItem[]> {
  if (mockAdapter?.getContacts) {
    return mockAdapter.getContacts();
  }

  const client = await getPersonalTelegramClient();
  if (!client) {
    throw new Error("Personal Telegram account is not authenticated or connected.");
  }

  const contactsList: PersonalContactItem[] = [];
  const seenIds = new Set<string>();

  // 1. Fetch recent dialogs
  const dialogs = await client.getDialogs({ limit: 40 });
  for (const d of dialogs) {
    const id = d.id?.toString() || "";
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);

    contactsList.push({
      id,
      name: d.title || d.name || "Unknown",
      username: (d.entity as any)?.username || undefined,
      phone: (d.entity as any)?.phone ? `+${(d.entity as any).phone}` : undefined,
      isUser: d.isUser || false,
      isGroup: d.isGroup || false,
      isChannel: d.isChannel || false,
      lastMessageSnippet: d.message?.message?.slice(0, 80) || undefined,
      unreadCount: d.unreadCount,
    });
  }

  return contactsList;
}

/**
 * Searches contacts and conversations by name, username, or phone.
 */
export async function searchPersonalContacts(query: string): Promise<PersonalContactItem[]> {
  const contacts = await getPersonalContacts();
  const q = query.trim().toLowerCase();

  return contacts.filter((c) => {
    return (
      c.name.toLowerCase().includes(q) ||
      (c.username && c.username.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  });
}

/**
 * Resolves a natural language recipient (e.g. "my wife", "Dani", "Sura") to a specific Telegram contact.
 * Uses alias directory, recipient records, and personal account contacts.
 */
export async function resolvePersonalRecipient(query: string): Promise<ResolveRecipientResult> {
  const trimmed = query.trim().toLowerCase();
  const creds = await getPersonalCredentials();

  const cleanTrimmed = trimmed.replace(/^(the|my)\s+/i, "");

  // 1. Check configured aliases in AppSetting (e.g. "wife" / "the wife" / "my wife" -> "Tigist Haile")
  let targetName = trimmed;
  if (creds.contactAliases[trimmed]) {
    targetName = creds.contactAliases[trimmed].toLowerCase();
  } else if (creds.contactAliases[cleanTrimmed]) {
    targetName = creds.contactAliases[cleanTrimmed].toLowerCase();
  } else if (trimmed === "my wife" || trimmed === "the wife" || trimmed === "wife") {
    if (creds.contactAliases["wife"]) {
      targetName = creds.contactAliases["wife"].toLowerCase();
    }
  }

  // 2. Check TelegramRecipient table for matching name or aliases
  const dbRecipients = await db.telegramRecipient.findMany();
  for (const r of dbRecipients) {
    const nameMatch =
      r.name.toLowerCase() === targetName ||
      r.name.toLowerCase() === trimmed ||
      r.name.toLowerCase() === cleanTrimmed;
    let aliasMatch = false;
    if (r.aliases) {
      const aliasList = r.aliases.split(",").map((a) => a.trim().toLowerCase());
      if (aliasList.includes(trimmed) || aliasList.includes(cleanTrimmed) || aliasList.includes(targetName)) {
        aliasMatch = true;
      }
    }

    if (nameMatch || aliasMatch) {
      return {
        resolved: true,
        peer: {
          id: r.chatId,
          name: r.name,
          username: r.username || undefined,
          isUser: r.type === "user",
          isGroup: r.type === "group",
          isChannel: false,
        },
      };
    }
  }

  // 3. Search via Personal Client Contacts & Dialogs
  let contacts: PersonalContactItem[] = [];
  try {
    contacts = await getPersonalContacts();
  } catch (err: any) {
    if (targetName !== trimmed) {
      const displayName = creds.contactAliases[cleanTrimmed] || creds.contactAliases["wife"] || targetName;
      return {
        resolved: false,
        error: `Personal account not connected, but alias maps "${query}" to "${displayName}". Connect personal account in Settings to send directly as yourself.`,
      };
    }
    return {
      resolved: false,
      error: err.message,
    };
  }

  // Exact ID, name, username, or phone match
  const exactMatches = contacts.filter(
    (c) =>
      c.id === targetName ||
      c.id === trimmed ||
      c.name.toLowerCase() === targetName ||
      c.name.toLowerCase() === trimmed ||
      (c.username && c.username.toLowerCase() === targetName.replace("@", "")) ||
      (c.phone && (c.phone === targetName || c.phone.replace("+", "") === targetName))
  );

  if (exactMatches.length === 1) {
    return {
      resolved: true,
      peer: exactMatches[0],
    };
  }

  // Substring matches
  const partialMatches = contacts.filter((c) =>
    c.name.toLowerCase().includes(targetName) ||
    c.name.toLowerCase().includes(trimmed)
  );

  if (partialMatches.length === 1) {
    return {
      resolved: true,
      peer: partialMatches[0],
    };
  }

  if (partialMatches.length > 1) {
    return {
      resolved: false,
      isAmbiguous: true,
      candidates: partialMatches.slice(0, 5),
      error: `Multiple contacts found matching "${query}". Please specify which person you mean.`,
    };
  }

  return {
    resolved: false,
    error: `Could not find any contact matching "${query}" in your personal Telegram account or alias directory.`,
  };
}

/**
 * Retrieves recent messages from a conversation with bounded limits (max 30).
 */
export async function getPersonalConversationMessages(
  peerIdOrUsername: string,
  limit: number = 10
): Promise<PersonalMessageItem[]> {
  const boundedLimit = Math.max(1, Math.min(limit, 30));

  if (mockAdapter?.getMessages) {
    return mockAdapter.getMessages(peerIdOrUsername, boundedLimit);
  }

  const client = await getPersonalTelegramClient();
  if (!client) {
    throw new Error("Personal Telegram account is not authenticated or connected.");
  }

  const rawMessages = await client.getMessages(peerIdOrUsername, {
    limit: boundedLimit,
  });

  const me = (await client.getMe()) as any;
  const myName = me.firstName || "Me";

  return rawMessages.map((m: any) => ({
    id: m.id,
    text: m.message || "",
    isOutgoing: Boolean(m.out),
    senderName: m.out ? myName : (m.sender?.firstName || "Contact"),
    timestamp: new Date(m.date * 1000).toISOString(),
  }));
}

/**
 * Sends a message from the user's personal Telegram account.
 * NEVER falls back to the bot token.
 */
export async function sendPersonalMessage(
  peerIdOrUsername: string,
  text: string
): Promise<{ success: boolean; messageId: number; timestamp: string }> {
  if (mockAdapter?.sendMessage) {
    const res = await mockAdapter.sendMessage(peerIdOrUsername, text);
    return { ...res, timestamp: new Date().toISOString() };
  }

  const client = await getPersonalTelegramClient();
  if (!client) {
    throw new Error("Cannot send message: Personal Telegram account is not authenticated or connected.");
  }

  const sent = await client.sendMessage(peerIdOrUsername, {
    message: text,
  });

  return {
    success: true,
    messageId: sent.id,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Sets or updates a contact alias (e.g. "wife" -> "Tigist").
 */
export async function setContactAlias(alias: string, contactName: string): Promise<{ success: boolean }> {
  const cleanAlias = alias.trim().toLowerCase();
  const cleanName = contactName.trim();

  const creds = await getPersonalCredentials();
  const aliases = { ...creds.contactAliases, [cleanAlias]: cleanName };

  await db.appSetting.upsert({
    where: { key: "TELEGRAM_CONTACT_ALIASES" },
    create: { key: "TELEGRAM_CONTACT_ALIASES", value: JSON.stringify(aliases) },
    update: { value: JSON.stringify(aliases) },
  });

  return { success: true };
}
