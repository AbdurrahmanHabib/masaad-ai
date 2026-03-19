# CLAUDE.md

## Project Overview

Masaad AI is a virtual AI company running on Telegram. 7 AI agents (CEO, Sales, Marketing, CTO, Finance, IR, DevOps) operate autonomously as digital employees, doing real business work for a construction HR tech startup.

## Architecture

- **Runtime**: Cloudflare Workers (serverless, free tier)
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Messaging**: Telegram Bot API (7 separate bots, 3 groups)
- **LLMs**: Gemini 2.5 Flash (primary) → Groq Llama 3.3 70B → Cerebras (fallback chain)
- **Cost**: $0/month — all free tier

## Commands

```bash
npm run dev          # Local development
npm run deploy       # Deploy to Cloudflare
npm run db:migrate   # Run D1 migrations locally
npm run db:migrate:remote  # Run D1 migrations on production
```

## Key Files

- `src/index.ts` — Main entry: cron handler + webhook router
- `src/agents/config.ts` — Agent definitions (personas, styles, goals)
- `src/agents/prompt.ts` — System/user prompt construction
- `src/llm/router.ts` — LLM provider fallback chain
- `src/state/db.ts` — D1 database operations
- `src/state/schema.sql` — Database schema
- `src/telegram/client.ts` — Telegram API wrapper
- `src/scheduler/planner.ts` — Agent scheduling with weighted round-robin + jitter

## Secrets (via wrangler secret, NEVER in code)

- `GEMINI_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY` — LLM providers
- `TG_BOT_CEO` through `TG_BOT_DEVOPS` — 7 Telegram bot tokens
- `TG_GROUP_HQ`, `TG_GROUP_SHOWCASE`, `TG_GROUP_DEV` — 3 group chat IDs

## Design Principles

- Agents post only when they have something substantive (SILENT threshold)
- 1-2 agents per 15-min cycle, not all 6 at once
- CEO is the default responder to untagged messages
- HQ group = full activity, Showcase group = curated outcomes only
- Every message must pass: "Would an executive post this with investors watching?"

## Telegram Groups

- **HQ**: Admin workspace — all agent activity, founder commands
- **Showcase**: Investor-facing — only polished outcomes cross-posted here
- **Dev**: Testing — experimental output during development

## Worker URL

https://masaad-ai.clothingdxb.workers.dev
