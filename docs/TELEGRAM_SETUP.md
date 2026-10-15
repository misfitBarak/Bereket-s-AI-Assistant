# Telegram Bot Integration & Setup Guide

This guide explains how to connect your **Personal AI Command Center** to your Telegram account.

---

## 1. Supported Commands & Capabilities

| Command | Function | Data Source |
| :--- | :--- | :--- |
| `/start` | Welcome message and overview of commands | Application Configuration |
| `/help` | Detailed help menu and example conversational prompts | Command Center Documentation |
| `/status` | AI connection health check, active provider, database stats | Live SQLite DB & Settings |
| `/tasks` | Active tasks formatted with priority, status, and assignees | Live SQLite `Task` Table |
| `/tasks abbay_tv` | Filter for Abbay TV broadcast graphics deliverables | Workspace Filter |
| `/tasks client` | Filter for freelance client deliverables | Workspace Filter |
| `/briefing` | Executive daily briefing: urgent priorities, department load | `get_today_focus` & `get_department_workload` |
| `/confirm` | Approve a consequential action (e.g. task deletion) | Safeguard Confirmation Engine |
| `/cancel` | Safely reject and clear a pending consequential action | Safeguard Confirmation Engine |
| *Natural Message* | Ordinary text routed through Google Gemini with all 12 tools | Real AI Tool-Calling Engine |

---

## 2. Quick Setup (3 Simple Steps)

### Step 1: Create Your Bot on Telegram
1. Open Telegram and search for [@BotFather](https://t.me/BotFather).
2. Send `/newbot`.
3. Choose a display name (e.g. `Abbay Assistant`) and a username ending in `bot` (e.g. `AbbayCommandBot`).
4. `@BotFather` will provide your **API Token** (e.g. `7123456789:ABCdefGHIjkl...`).

### Step 2: Get Your Numeric User ID
To ensure only you can access the bot:
1. Search for [@userinfobot](https://t.me/userinfobot) on Telegram and send `/start`.
2. It will reply with your numeric **Id** (e.g. `987654321`).

### Step 3: Configure Your Credentials
You can configure credentials using either of the following two options:

#### Option A: In the Web UI (Zero File Edits)
1. Open [http://localhost:3000](http://localhost:3000) in your browser.
2. Go to **Settings & AI**.
3. Under the **Telegram Bot Integration** card:
   - Paste your **Telegram Bot Token**
   - Enter your **Allowed Telegram User ID**
   - (Optional) Enter a **Webhook Secret Token**
4. Click **Save Telegram Configuration**.

#### Option B: In the [.env](file:///c:/Users/Abbay1/Desktop/A/.env) file
Open [.env](file:///c:/Users/Abbay1/Desktop/A/.env) and set:
```env
TELEGRAM_BOT_TOKEN="7123456789:ABCdefGHIjkl..."
TELEGRAM_ALLOWED_USER_ID="987654321"
TELEGRAM_WEBHOOK_SECRET="my_custom_secret_phrase"
```

---

## 3. Local Development: Test Immediately (No Public IP Needed!)

Because Telegram servers cannot reach `http://localhost:3000` directly, we provide a zero-friction long-polling runner:

1. Ensure the web app is running in one terminal:
   ```powershell
   cmd /c "npm.cmd run start"
   ```
2. In a second terminal, run the Telegram polling service:
   ```powershell
   cmd /c "npm.cmd run telegram:poll"
   ```
3. Open Telegram on your phone or desktop, find your bot, and send `/start` or `/briefing`!
   - Messages are received over outbound HTTPS directly from Telegram's API.
   - No tunnels, no domain names, and no open router ports are required.

---

## 4. Production Webhook Deployment

For permanent cloud deployment or public webhook testing:

### Option A: Free Cloudflare Tunnel (Zero Account Required)
1. Download `cloudflared`:
   ```powershell
   winget install Cloudflare.cloudflared
   ```
2. Start the tunnel:
   ```powershell
   cloudflared tunnel --url http://localhost:3000
   ```
3. Copy the generated HTTPS address (e.g. `https://xyz.trycloudflare.com`).
4. Register the webhook with Telegram:
   ```powershell
   curl -F "url=https://xyz.trycloudflare.com/api/telegram/webhook" -F "secret_token=my_custom_secret_phrase" https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
   ```

### Option B: Verify Webhook Health
Check Telegram's webhook delivery status:
```powershell
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

---

## 5. Security Architecture

- **Private 1-to-1 Only**: Group messages and channel forwards are rejected by default.
- **Strict User Whitelisting**: Updates from any Telegram ID not matching `TELEGRAM_ALLOWED_USER_ID` receive an access denied notice.
- **Secret Token Validation**: When using webhooks, the `X-Telegram-Bot-Api-Secret-Token` header is strictly verified against `TELEGRAM_WEBHOOK_SECRET`.
- **Deduplication**: In-memory sliding set prevents duplicate processing of Telegram retries.
- **Consequential Safeguards**: Dangerous operations like deleting tasks require an explicit `/confirm` reply before database execution.
- **Credential Isolation**: Tokens and AI keys are strictly kept on the server and are never exposed in Telegram messages, client bundles, or logs.
