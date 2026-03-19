import { AgentState, AgentRole, Env } from '../types';

export async function getAgentState(db: D1Database, role: AgentRole): Promise<AgentState> {
  const row = await db.prepare('SELECT * FROM agent_state WHERE role = ?').bind(role).first();
  if (!row) throw new Error(`No state for agent: ${role}`);
  return {
    role: row.role as string,
    current_goals: JSON.parse(row.current_goals as string),
    completed: JSON.parse(row.completed as string),
    pending_tags: JSON.parse(row.pending_tags as string),
    last_active: row.last_active as string,
    cycle_count: row.cycle_count as number,
    weekly_messages_sent: row.weekly_messages_sent as number,
  };
}

export async function updateAgentState(
  db: D1Database,
  role: AgentRole,
  updates: Partial<AgentState>
): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.current_goals !== undefined) {
    sets.push('current_goals = ?');
    values.push(JSON.stringify(updates.current_goals));
  }
  if (updates.completed !== undefined) {
    sets.push('completed = ?');
    values.push(JSON.stringify(updates.completed));
  }
  if (updates.pending_tags !== undefined) {
    sets.push('pending_tags = ?');
    values.push(JSON.stringify(updates.pending_tags));
  }
  if (updates.last_active !== undefined) {
    sets.push('last_active = ?');
    values.push(updates.last_active);
  }
  if (updates.cycle_count !== undefined) {
    sets.push('cycle_count = ?');
    values.push(updates.cycle_count);
  }
  if (updates.weekly_messages_sent !== undefined) {
    sets.push('weekly_messages_sent = ?');
    values.push(updates.weekly_messages_sent);
  }

  sets.push("updated_at = datetime('now')");
  values.push(role);

  await db.prepare(`UPDATE agent_state SET ${sets.join(', ')} WHERE role = ?`).bind(...values).run();
}

export async function getRecentMessages(
  db: D1Database,
  groupType: 'hq' | 'showcase' | 'dev',
  limit: number = 10
): Promise<Array<{ sender_role: string; content: string; created_at: string }>> {
  const rows = await db
    .prepare('SELECT sender_role, content, created_at FROM messages WHERE group_type = ? ORDER BY created_at DESC LIMIT ?')
    .bind(groupType, limit)
    .all();
  return (rows.results || []).reverse() as Array<{ sender_role: string; content: string; created_at: string }>;
}

export async function saveMessage(
  db: D1Database,
  groupType: 'hq' | 'showcase' | 'dev',
  senderRole: string,
  content: string,
  messageId?: number
): Promise<void> {
  await db
    .prepare('INSERT INTO messages (group_type, sender_role, content, message_id) VALUES (?, ?, ?, ?)')
    .bind(groupType, senderRole, content, messageId || null)
    .run();
}

export async function getPendingTasks(
  db: D1Database,
  forRole: AgentRole
): Promise<Array<{ id: number; from_role: string; task: string; context: string; priority: string }>> {
  const rows = await db
    .prepare("SELECT id, from_role, task, context, priority FROM tasks WHERE to_role = ? AND status = 'pending' ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END")
    .bind(forRole)
    .all();
  return (rows.results || []) as Array<{ id: number; from_role: string; task: string; context: string; priority: string }>;
}

export async function createTask(
  db: D1Database,
  fromRole: AgentRole,
  toRole: AgentRole,
  task: string,
  context: string = '',
  priority: string = 'normal'
): Promise<void> {
  await db
    .prepare('INSERT INTO tasks (from_role, to_role, task, context, priority) VALUES (?, ?, ?, ?, ?)')
    .bind(fromRole, toRole, task, context, priority)
    .run();
}

export async function completeTask(db: D1Database, taskId: number): Promise<void> {
  await db
    .prepare("UPDATE tasks SET status = 'done', completed_at = datetime('now') WHERE id = ?")
    .bind(taskId)
    .run();
}

export async function isShutdown(db: D1Database): Promise<boolean> {
  const row = await db.prepare("SELECT value FROM flags WHERE key = 'shutdown'").first();
  return row?.value === 'true';
}

export async function setShutdown(db: D1Database, value: boolean): Promise<void> {
  await db
    .prepare("UPDATE flags SET value = ?, updated_at = datetime('now') WHERE key = 'shutdown'")
    .bind(value ? 'true' : 'false')
    .run();
}
