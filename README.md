# Abbay AI Command Center
**Personal AI-Powered Command Center for Abbay TV Graphics Department, Freelance Client Work, and Personal Media Ventures**

---

## 🌟 Executive Overview

The **Abbay AI Command Center** is a production-grade, full-stack, chat-first web application designed specifically for **Abbay**, a Senior Video Editor, Motion Graphics Professional, and **Head of the Graphics Department at Abbay TV** (Ethiopia).

The application unifies three distinct, strictly compartmentalized workspaces within a single intelligent operational core:

1. **Abbay TV Graphics Department**:
   - Shared team workload board and active capacity monitoring across 5 artists: **Dani** (3D & Media Packs), **Sura** (Promos & Color), **Simon** (Broadcast Lower Thirds & L-Shapes), **Kiru** (Thumbnails & Print Posters), and **Bereket** (Cutdowns & 9:16 Social Re-sizes).
   - Real-time detection of overloaded artists and one-click workload balancing recommendations.
   - Deliverable-specific categorization (Promos, Adverts, Lower Thirds, L-Shapes, Thumbnails, Posters, Media Packs, Broadcast Graphics).
   - Automated 1-click **Executive Management Weekly Report** generator formatted in markdown for station leadership.

2. **Client Work (Freelance & Commercial Production)**:
   - Client registry (e.g. *EthioTelecom*, *ShebaPay*), active campaigns, animatics, and DaVinci Resolve delivery specs.
   - Revision tracking with strict scope boundaries (e.g., maximum 3 revision rounds).
   - **Confidential Financial Management**: Track quoted project scopes, deposits paid, and pending balances (in ETB or USD) with a one-click privacy toggle to shield financials during screen-sharing.

3. **Personal Projects & Long-Term Ambitions**:
   - Educational content creation: *Motion Design & DaVinci Resolve Masterclass*.
   - Digital product assets: *Broadcast Fusion Presets & LUT Packs*.
   - R&D and Automation: *AI Whisper-based Amharic subtitle cutdown pipelines*.
   - Milestone tracking, progress bars, and high-impact next actions.

---

## 💬 Chat-First AI Assistant & Intelligent Engine

The primary interface is a conversational AI assistant connected to live application data through structured tool calling. 

### Supported Natural Language Commands:
- `"What should I focus on today?"` &rarr; Analyzes urgent deliverables across all 3 workspaces and schedules priority timeblocks.
- `"Show me everything overdue."` &rarr; Scans for tasks with past deadlines that are not completed.
- `"What is everyone in the Graphics Department working on?"` &rarr; Retrieves live capacity, active deliverables, and overload status for Dani, Sura, Simon, Kiru, and Bereket.
- `"I have three urgent adverts and two people available. Help me distribute the workload."` &rarr; Evaluates skillsets and current hours to deliver an optimal, bottleneck-free rebalancing recommendation.
- `"Add a task for Dani to finish the MMA media pack by Thursday."` &rarr; Parses assignee, deliverable type, priority, and due date, creating the record directly in the database.
- `"delete task MMA Media Pack"` &rarr; **Consequential Action Safeguard**: Generates an explicit approval card before any destructive changes occur.
- `"Plan my week around my Abbay TV responsibilities and freelance work."` &rarr; Generates time blocks separating TV leadership, client editing hours, and personal evening creative sessions.
- `"What have I been neglecting lately?"` &rarr; Detects projects with low momentum or missing next actions.
- `"Remind me what I decided about my last project."` &rarr; Semantically searches persistent memory vault for past decisions and station agreements.

### Configurable AI Providers:
- **Google Gemini** (Gemini 1.5 Flash / Gemini 2.0 Flash)
- **OpenAI** (GPT-4o)
- **Anthropic Claude** (Claude 3.5 Sonnet)
- **Groq** (High-speed Llama 3.3 70B)
- **Local Ollama** (`http://localhost:11434`)
- **Built-in Autonomous Engine (Demo Mode)**: Operates with deep intent parsing, live SQLite/PostgreSQL tool calls, and real calculations when no external API key is entered.

---

## 🏗️ Technical Architecture

- **Framework**: Next.js 14 (App Router, React 18, TypeScript)
- **Styling**: Tailwind CSS with automatic Dark/Light theme switching
- **ORM & Database**: Prisma ORM with SQLite for zero-friction local development, easily switchable to PostgreSQL (Supabase / Neon / Vercel Postgres) for cloud production.
- **AI Tool Layer**: Native function declaration schema and execution engine (`src/lib/ai/tools.ts`, `src/lib/ai/engine.ts`).
- **Data Safety**: End-to-end full database JSON backup export & restore (`/api/export`).
- **Icons**: Lucide React.
- **PWA Ready**: Web App Manifest (`public/manifest.json`), responsive layout for mobile, tablet, and desktop.

---

## 🚀 Running Locally

### 1. Prerequisites
- Node.js 18+ (tested on Node v24.21.0)
- npm or pnpm

### 2. Setup & Installation
```bash
# 1. Install dependencies and generate Prisma Client
npm install

# 2. Synchronize database schema (creates local dev.db)
npx prisma db push

# 3. Seed initial department data (Dani, Sura, Simon, Kiru, Bereket, TV projects, clients, memories)
npx tsx src/scripts/seed.ts
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Production Build
```bash
npm run build
npm run start
```

---

## 🔑 AI Provider & Database Configuration

Edit `.env` (or configure in the in-app **Settings & AI** tab):

```env
# Database connection (SQLite for local dev, PostgreSQL for production)
DATABASE_URL="file:./dev.db"

# Optional Cloud AI API Keys (leave blank to run in Demo / Intelligent Local Engine mode)
AI_PROVIDER="auto"
GEMINI_API_KEY="your-gemini-api-key"
OPENAI_API_KEY="your-openai-api-key"
ANTHROPIC_API_KEY="your-anthropic-api-key"
GROQ_API_KEY="your-groq-api-key"
OLLAMA_BASE_URL="http://localhost:11434"
```

---

## ☁️ Deployment Guide (Vercel + PostgreSQL)

1. **Database Setup**:
   - Provision a PostgreSQL database on [Supabase](https://supabase.com), [Neon](https://neon.tech), or Vercel Postgres.
   - Update `prisma/schema.prisma`:
     ```prisma
     datasource db {
       provider = "postgresql"
       url      = env("DATABASE_URL")
     }
     ```
2. **Environment Variables**:
   - Set `DATABASE_URL` to your PostgreSQL connection string with SSL (`?sslmode=require`).
   - Add your chosen `GEMINI_API_KEY` or `OPENAI_API_KEY`.
3. **Deploy to Vercel**:
   ```bash
   vercel
   ```
   Or connect your Git repository in the Vercel dashboard. The `postinstall` script will automatically run `prisma generate`.

---

## 🛡️ Reliability & Safety Safeguards
- **Consequential Actions**: Deleting tasks, removing projects, or reassigning workloads produces an interactive confirmation card requiring explicit user approval before execution.
- **Confidential Billing**: Client amounts can be shielded with the "Hide Financials" toggle for privacy during live screen shares.
- **Zero Hallucination Mode**: The assistant queries live database entities and acknowledges when data does not exist instead of fabricating tasks or deadlines.
