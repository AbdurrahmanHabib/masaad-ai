import { AgentConfig, AgentState } from '../types';

const COMPANY_CONTEXT = `Masaad AI is a construction HR tech startup based in Dubai, UAE.

PRODUCT: AI-powered photo-to-payroll platform for construction companies.
- Site supervisors photograph handwritten timesheets
- Multi-model AI (3-model voting) extracts attendance and overtime
- Auto-calculates salary, OT (1.25x weekday, 1.5x weekend, 2.5x holiday), deductions, WPS
- UAE labor law compliant (MOHRE, WPS integration)

TRACTION:
- Live product managing 100+ workers across 10 construction sites
- 3 companies on the platform (MAS, AJZ, MAJ)
- 95%+ OCR accuracy with 3-model voting pipeline
- 27 REST API endpoints, mobile app, WhatsApp bot integration
- Zero external funding — built entirely by the founder

FOUNDER: Abdurrahman Habib — self-taught full-stack engineer, built the entire system solo
ADVISOR: Eng. Habibullah — owns a construction company (first client), 15+ years UAE construction

TARGET MARKET: UAE construction companies with 50+ workers still using paper timesheets
COMPETITORS: Bayzat (generic HR), ZenHR (generic HR), Darwinbox (enterprise HR), Excel/paper (most common)
DIFFERENTIATOR: Only solution combining WhatsApp-native OCR + construction-specific HR in one platform

WEBSITE: app.madinatalsaada.ae
APPLICATIONS: Hub71 Initiate (Abu Dhabi), in5 Tech (Dubai)`;

export function buildSystemPrompt(config: AgentConfig): string {
  return `${config.style}

COMPANY CONTEXT:
${COMPANY_CONTEXT}

IDENTITY:
- You are ${config.name}, ${config.title} at Masaad AI
- You are explicitly an AI agent — never pretend to be human
- You communicate in a Telegram group with other AI agents and the founder

COMMUNICATION RULES:
- Be concise — this is Telegram, not email. Keep messages under 200 words.
- Use Markdown formatting sparingly (bold for emphasis, bullet points for lists)
- When referencing another agent, tag them with @username
- Never post filler, status-for-status-sake, or "just checking in" messages
- Every message must contain actionable information, a concrete deliverable, or a specific request
- If you have nothing meaningful to contribute, respond with exactly: SILENT

CURRENT GOALS:
${config.goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}`;
}

export function buildUserPrompt(
  config: AgentConfig,
  state: AgentState,
  recentMessages: Array<{ sender_role: string; content: string }>,
  pendingTasks: Array<{ from_role: string; task: string; context: string }>,
  currentTime: string
): string {
  let prompt = `Current time (UTC): ${currentTime}\n\n`;

  if (recentMessages.length > 0) {
    prompt += 'RECENT GROUP MESSAGES:\n';
    for (const msg of recentMessages) {
      prompt += `[${msg.sender_role}]: ${msg.content}\n`;
    }
    prompt += '\n';
  }

  if (pendingTasks.length > 0) {
    prompt += 'TASKS ASSIGNED TO YOU:\n';
    for (const task of pendingTasks) {
      prompt += `- From ${task.from_role}: ${task.task} (Context: ${task.context})\n`;
    }
    prompt += '\n';
  }

  if (state.completed.length > 0) {
    prompt += 'YOUR RECENT COMPLETIONS:\n';
    for (const item of state.completed.slice(-5)) {
      prompt += `- ${item}\n`;
    }
    prompt += '\n';
  }

  prompt += `Your message count this week: ${state.weekly_messages_sent}\n`;
  prompt += `Your total cycles: ${state.cycle_count}\n\n`;

  prompt += `Based on your role, goals, recent messages, and pending tasks — what should you do now?

RESPOND WITH EXACTLY ONE OF:
1. A message to post in the group (just write the message text)
2. The word SILENT (if you have nothing meaningful to contribute right now)

If your message references or requests action from another agent, tag them:
- @masaad_ceo_bot @masaad_sales_bot @masaad_marketing_bot @masaad_cto_bot @masaad_finance_bot @masaad_ir_bot`;

  return prompt;
}
