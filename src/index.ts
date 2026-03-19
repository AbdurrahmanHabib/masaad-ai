import { Env, TelegramUpdate, AgentRole } from './types';
import { AGENTS, getAgentConfig, getBotToken, isAgentAvailable } from './agents/config';
import { buildSystemPrompt, buildUserPrompt } from './agents/prompt';
import { callLLM } from './llm/router';
import { sendMessage } from './telegram/client';
import {
  getAgentState,
  updateAgentState,
  getRecentMessages,
  saveMessage,
  getPendingTasks,
  completeTask,
  isShutdown,
  setShutdown,
} from './state/db';
import {
  selectAgentsForCycle,
  isMorningBriefTime,
  isEveningSummaryTime,
  isDevOpsTime,
  getJitterDelay,
} from './scheduler/planner';
import { generateImage, sendTelegramPhoto } from './integrations/image';

export default {
  // Cron trigger: autonomous agent cycles
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Check kill switch
    if (await isShutdown(env.DB)) return;

    const now = new Date();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    const cycleNumber = Math.floor(now.getTime() / (15 * 60 * 1000));

    // Determine which agents run this cycle
    const agentStates: Record<string, string> = {};
    for (const agent of AGENTS) {
      const state = await getAgentState(env.DB, agent.role as AgentRole);
      agentStates[agent.role] = state.last_active;
    }

    const selectedRoles = selectAgentsForCycle(cycleNumber, agentStates);

    // Check for special time-based events
    if (isMorningBriefTime(hour) && !selectedRoles.includes('ceo')) {
      selectedRoles.unshift('ceo');
    }
    if (isEveningSummaryTime(hour) && !selectedRoles.includes('ceo')) {
      selectedRoles.unshift('ceo');
    }
    if (isDevOpsTime(minute) && !selectedRoles.includes('devops')) {
      selectedRoles.push('devops');
    }

    // Run selected agents
    for (const role of selectedRoles) {
      const jitter = getJitterDelay(role, cycleNumber);

      ctx.waitUntil(
        new Promise<void>((resolve) => {
          setTimeout(async () => {
            try {
              await runAgent(env, role);
            } catch (e) {
              console.error(`Agent ${role} failed:`, e);
            }
            resolve();
          }, jitter);
        })
      );
    }
  },

  // Webhook: instant responses to group messages
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', time: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Webhook endpoint for all bots: /webhook/<role>
    const webhookMatch = url.pathname.match(/^\/webhook\/(\w+)$/);
    if (webhookMatch && request.method === 'POST') {
      const role = webhookMatch[1] as AgentRole;
      const config = getAgentConfig(role);
      if (!config) return new Response('Unknown agent', { status: 404 });

      const update: TelegramUpdate = await request.json();
      ctx.waitUntil(handleWebhook(env, role, update));

      return new Response('ok');
    }

    // Setup endpoint: register webhooks for all bots
    if (url.pathname === '/setup' && request.method === 'POST') {
      return await setupWebhooks(env, url.origin);
    }

    // Admin commands
    if (url.pathname === '/admin/shutdown' && request.method === 'POST') {
      await setShutdown(env.DB, true);
      return new Response('All agents shut down');
    }
    if (url.pathname === '/admin/resume' && request.method === 'POST') {
      await setShutdown(env.DB, false);
      return new Response('All agents resumed');
    }

    return new Response('Masaad AI Orchestrator', { status: 200 });
  },
};

async function runAgent(env: Env, role: AgentRole): Promise<void> {
  const config = getAgentConfig(role);
  if (!config || !isAgentAvailable(env, config)) return;

  const state = await getAgentState(env.DB, role);
  const recentMessages = await getRecentMessages(env.DB, 'hq', 10);
  const pendingTasks = await getPendingTasks(env.DB, role);

  const systemPrompt = buildSystemPrompt(config);
  const userPrompt = buildUserPrompt(
    config,
    state,
    recentMessages,
    pendingTasks,
    new Date().toISOString()
  );

  const llmResponse = await callLLM(env, systemPrompt, userPrompt);

  if (!llmResponse.content || llmResponse.provider === 'none') return;

  const content = llmResponse.content.trim();

  // Check for SILENT response
  if (content === 'SILENT' || content === 'silent') {
    await updateAgentState(env.DB, role, {
      last_active: new Date().toISOString(),
      cycle_count: state.cycle_count + 1,
    });
    return;
  }

  const botToken = getBotToken(env, config);

  // Check if agent wants to generate an image
  const imageMatch = content.match(/IMAGE_PROMPT:\s*(.+?)(?:\n|$)/);
  if (imageMatch) {
    const imagePrompt = imageMatch[1].trim();
    const textContent = content.replace(/IMAGE_PROMPT:\s*.+?(?:\n|$)/, '').trim();

    // Generate image
    const imageBase64 = await generateImage(env.GEMINI_API_KEY, imagePrompt, '1:1');

    if (imageBase64) {
      // Send image with caption to HQ
      await sendTelegramPhoto(botToken, env.TG_GROUP_HQ, imageBase64, textContent || 'Generated visual');
      await saveMessage(env.DB, 'hq', role, `[IMAGE] ${textContent}`, undefined);

      // Also send to showcase if it's marketing content
      if (role === 'marketing' || shouldPostToShowcase(role, textContent)) {
        await sendTelegramPhoto(botToken, env.TG_GROUP_SHOWCASE, imageBase64, textContent || '');
        await saveMessage(env.DB, 'showcase', role, `[IMAGE] ${textContent}`, undefined);
      }
    } else if (textContent) {
      // Image generation failed, still post the text
      const msgId = await sendMessage(botToken, env.TG_GROUP_HQ, textContent);
      if (msgId) await saveMessage(env.DB, 'hq', role, textContent, msgId);
    }
  } else {
    // Regular text message
    const msgId = await sendMessage(botToken, env.TG_GROUP_HQ, content);

    if (msgId) {
      await saveMessage(env.DB, 'hq', role, content, msgId);

      if (shouldPostToShowcase(role, content)) {
        await sendMessage(botToken, env.TG_GROUP_SHOWCASE, content);
        await saveMessage(env.DB, 'showcase', role, content);
      }
    }
  }

  // Mark pending tasks as done if agent addressed them
  for (const task of pendingTasks) {
    if (content.toLowerCase().includes(task.task.toLowerCase().split(' ').slice(0, 3).join(' '))) {
      await completeTask(env.DB, task.id);
    }
  }

  // Update agent state
  await updateAgentState(env.DB, role, {
    last_active: new Date().toISOString(),
    cycle_count: state.cycle_count + 1,
    weekly_messages_sent: state.weekly_messages_sent + 1,
  });
}

function shouldPostToShowcase(role: AgentRole, content: string): boolean {
  // CEO morning/evening briefs go to showcase
  if (role === 'ceo') return true;

  // Messages with concrete outcomes go to showcase
  const outcomeKeywords = [
    'completed', 'sent', 'published', 'booked', 'meeting scheduled',
    'pipeline report', 'weekly report', 'analysis complete',
    'response received', 'converted', 'signed',
  ];
  const lowerContent = content.toLowerCase();
  return outcomeKeywords.some((kw) => lowerContent.includes(kw));
}

async function handleWebhook(env: Env, role: AgentRole, update: TelegramUpdate): Promise<void> {
  if (await isShutdown(env.DB)) return;

  const message = update.message;
  if (!message?.text) return;

  const text = message.text;

  // Handle founder commands
  if (!message.from?.is_bot) {
    // Kill switch
    if (text === '/shutdown') {
      await setShutdown(env.DB, true);
      const ceoToken = getBotToken(env, getAgentConfig('ceo')!);
      await sendMessage(ceoToken, env.TG_GROUP_HQ, 'All agents shut down by founder.');
      return;
    }
    if (text === '/resume') {
      await setShutdown(env.DB, false);
      const ceoToken = getBotToken(env, getAgentConfig('ceo')!);
      await sendMessage(ceoToken, env.TG_GROUP_HQ, 'All agents resumed by founder.');
      return;
    }
    if (text === '/status') {
      await runDevOpsCheck(env);
      return;
    }

    // If founder tags a specific agent, only that agent responds
    for (const agent of AGENTS) {
      if (text.includes(`@${agent.username}`)) {
        await saveMessage(env.DB, 'hq', 'founder', text, message.message_id);
        await runAgent(env, agent.role as AgentRole);
        return;
      }
    }

    // Default: CEO responds to untagged founder messages
    await saveMessage(env.DB, 'hq', 'founder', text, message.message_id);
    await runAgent(env, 'ceo');
    return;
  }

  // Bot-to-bot: if a bot tags another bot, save and let next cycle handle it
  await saveMessage(env.DB, 'hq', role, text, message.message_id);
}

async function runDevOpsCheck(env: Env): Promise<void> {
  const devopsConfig = getAgentConfig('devops')!;
  const botToken = getBotToken(env, devopsConfig);
  const issues: string[] = [];

  // Check each agent's last activity
  for (const agent of AGENTS) {
    if (agent.role === 'devops') continue;
    const state = await getAgentState(env.DB, agent.role as AgentRole);
    if (state.last_active) {
      const hoursSince = (Date.now() - new Date(state.last_active).getTime()) / (1000 * 60 * 60);
      if (hoursSince > 4) {
        issues.push(`${agent.name}: silent for ${hoursSince.toFixed(1)}h`);
      }
    } else {
      issues.push(`${agent.name}: never activated`);
    }
  }

  // Check LLM availability
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`);
    if (!res.ok) issues.push(`Gemini API: ${res.status}`);
  } catch {
    issues.push('Gemini API: unreachable');
  }

  if (issues.length === 0) {
    // Only post health status if explicitly requested (via /status)
    await sendMessage(botToken, env.TG_GROUP_HQ, 'System health: All agents active. All APIs reachable.');
  } else {
    const alert = `System health alert:\n${issues.map((i) => `- ${i}`).join('\n')}`;
    await sendMessage(botToken, env.TG_GROUP_HQ, alert);
  }
}

async function setupWebhooks(env: Env, origin: string): Promise<Response> {
  const results: Record<string, boolean> = {};

  for (const agent of AGENTS) {
    const token = getBotToken(env, agent);
    const url = `${origin}/webhook/${agent.role}`;

    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, allowed_updates: ['message', 'callback_query'] }),
    });

    results[agent.role] = res.ok;
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
