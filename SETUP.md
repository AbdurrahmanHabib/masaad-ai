# Masaad AI — Setup Guide

## Prerequisites

- Node.js 18+ installed
- Cloudflare account (free)
- Telegram account

## Step 1: Create Telegram Bots

Message [@BotFather](https://t.me/BotFather) on Telegram and create 7 bots:

| Bot | Name | Username |
|-----|------|----------|
| CEO | Masaad CEO AI | @masaad_ceo_bot |
| Sales | Masaad Sales AI | @masaad_sales_bot |
| Marketing | Masaad Marketing AI | @masaad_marketing_bot |
| CTO | Masaad CTO AI | @masaad_cto_bot |
| Finance | Masaad Finance AI | @masaad_finance_bot |
| IR | Masaad IR AI | @masaad_ir_bot |
| DevOps | Masaad DevOps AI | @masaad_devops_bot |

Save each bot token. Set profile pictures and bios via BotFather.

## Step 2: Create Telegram Groups

Create 3 groups:
1. **Masaad AI HQ** — Add all 7 bots + yourself
2. **Masaad AI Showcase** — Add all 7 bots + yourself (invite investors later)
3. **Masaad AI Dev** — Add all 7 bots + yourself (testing)

Get each group's chat ID:
- Add @userinfobot to each group, it will reply with the chat ID
- Remove @userinfobot after getting the IDs

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Cloudflare Setup

```bash
# Login to Cloudflare
npx wrangler login

# Create the D1 database
npx wrangler d1 create masaad-ai-db
# Copy the database_id from the output into wrangler.toml

# Run database migrations
npm run db:migrate:remote
```

## Step 5: Set Secrets

Never put these in code. Use wrangler secrets:

```bash
# LLM API Keys
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put CEREBRAS_API_KEY

# Telegram Bot Tokens
npx wrangler secret put TG_BOT_CEO
npx wrangler secret put TG_BOT_SALES
npx wrangler secret put TG_BOT_MARKETING
npx wrangler secret put TG_BOT_CTO
npx wrangler secret put TG_BOT_FINANCE
npx wrangler secret put TG_BOT_IR
npx wrangler secret put TG_BOT_DEVOPS

# Telegram Group Chat IDs
npx wrangler secret put TG_GROUP_HQ
npx wrangler secret put TG_GROUP_SHOWCASE
npx wrangler secret put TG_GROUP_DEV

# Gmail (optional — set up later)
# npx wrangler secret put GMAIL_REFRESH_TOKEN
# npx wrangler secret put GMAIL_CLIENT_ID
# npx wrangler secret put GMAIL_CLIENT_SECRET

# Buffer (optional — set up later)
# npx wrangler secret put BUFFER_ACCESS_TOKEN

# Twitter (optional — set up later)
# npx wrangler secret put TWITTER_BEARER_TOKEN
```

## Step 6: Deploy

```bash
npm run deploy
```

## Step 7: Register Webhooks

After deploying, register Telegram webhooks:

```bash
curl -X POST https://masaad-ai.<your-subdomain>.workers.dev/setup
```

## Step 8: Verify

1. Send a message in the HQ group — CEO should respond
2. Wait 15 minutes — agents should start posting autonomously
3. Send `/status` in HQ — DevOps bot reports health

## Commands

In the HQ Telegram group:
- `/shutdown` — Stop all agents immediately
- `/resume` — Resume all agents
- `/status` — Get system health report
- `@masaad_sales_bot <message>` — Direct a specific agent

## Architecture

```
Cloudflare Worker (cron every 15min + webhook)
    ├── Gemini 2.5 Flash (primary LLM)
    ├── Groq Llama 3.3 70B (fallback)
    ├── Cerebras Llama 70B (tertiary)
    ├── Cloudflare D1 (state/memory)
    └── Telegram Bot API (7 bots, 3 groups)
```
