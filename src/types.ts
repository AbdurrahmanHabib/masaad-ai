export interface Env {
  DB: D1Database;
  ENV: string;

  // LLM keys (set via wrangler secret put)
  GEMINI_API_KEY: string;
  GROQ_API_KEY: string;
  CEREBRAS_API_KEY: string;

  // Telegram bot tokens (set via wrangler secret put)
  TG_BOT_CEO: string;
  TG_BOT_SALES: string;
  TG_BOT_MARKETING: string;
  TG_BOT_CTO: string;
  TG_BOT_FINANCE: string;
  TG_BOT_IR: string;
  TG_BOT_DEVOPS: string;

  // Telegram group chat IDs
  TG_GROUP_HQ: string;
  TG_GROUP_SHOWCASE: string;
  TG_GROUP_DEV: string;

  // Integrations (set via wrangler secret put)
  GMAIL_REFRESH_TOKEN: string;
  GMAIL_CLIENT_ID: string;
  GMAIL_CLIENT_SECRET: string;
  BUFFER_ACCESS_TOKEN: string;
  TWITTER_BEARER_TOKEN: string;
  GOOGLE_SHEETS_API_KEY: string;
}

export type AgentRole = 'ceo' | 'sales' | 'marketing' | 'cto' | 'finance' | 'ir' | 'devops';

export interface AgentConfig {
  role: AgentRole;
  name: string;
  username: string;
  title: string;
  style: string;
  goals: string[];
  cronWeight: number; // Higher = runs more often
  botTokenKey: keyof Env;
}

export interface AgentState {
  role: string;
  current_goals: string[];
  completed: string[];
  pending_tags: string[];
  last_active: string;
  cycle_count: number;
  weekly_messages_sent: number;
}

export interface TelegramMessage {
  message_id: number;
  from?: { id: number; is_bot: boolean; first_name: string; username?: string };
  chat: { id: number; title?: string; type: string };
  date: number;
  text?: string;
  reply_to_message?: TelegramMessage;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface LLMResponse {
  content: string;
  provider: string;
  tokens_used: number;
}

export interface AgentDecision {
  action: 'post' | 'silent' | 'draft_email' | 'post_showcase';
  content: string;
  tag_agents?: AgentRole[];
  email?: { to: string; subject: string; body: string };
  showcase_summary?: string;
}
