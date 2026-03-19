import { AgentRole } from '../types';
import { AGENTS } from '../agents/config';

// Weighted round-robin with jitter
// Higher cronWeight = more likely to be selected each cycle
export function selectAgentsForCycle(
  cycleNumber: number,
  agentLastActive: Record<string, string>
): AgentRole[] {
  const now = Date.now();
  const selected: AgentRole[] = [];

  // Build weighted pool (exclude devops — it runs on its own schedule)
  const candidates = AGENTS.filter((a) => a.role !== 'devops');

  // Score each agent: weight + staleness bonus
  const scored = candidates.map((agent) => {
    const lastActive = agentLastActive[agent.role];
    const msSinceActive = lastActive ? now - new Date(lastActive).getTime() : Infinity;
    const hoursSinceActive = msSinceActive / (1000 * 60 * 60);

    // Base score from weight
    let score = agent.cronWeight;

    // Bonus for agents that haven't posted recently
    if (hoursSinceActive > 4) score += 3;
    else if (hoursSinceActive > 2) score += 2;
    else if (hoursSinceActive > 1) score += 1;

    // Penalty for agents that posted very recently (< 30 min)
    if (hoursSinceActive < 0.5) score -= 2;

    // Add deterministic pseudo-random factor based on cycle number
    const hash = simpleHash(`${agent.role}-${cycleNumber}`);
    score += (hash % 3);

    return { role: agent.role as AgentRole, score };
  });

  // Sort by score descending, pick top 1-2
  scored.sort((a, b) => b.score - a.score);

  // Always pick the top scorer
  selected.push(scored[0].role);

  // Pick second agent only if its score is close (within 2) to prevent flooding
  if (scored.length > 1 && scored[1].score >= scored[0].score - 2) {
    selected.push(scored[1].role);
  }

  return selected;
}

// Check if it's time for CEO's morning brief (8am UAE = 4am UTC)
export function isMorningBriefTime(hour: number): boolean {
  return hour === 4; // 8am UAE (UTC+4)
}

// Check if it's time for CEO's evening summary (6pm UAE = 2pm UTC)
export function isEveningSummaryTime(hour: number): boolean {
  return hour === 14; // 6pm UAE (UTC+4)
}

// Check if it's Monday morning for weekly planning
export function isWeeklyPlanningTime(dayOfWeek: number, hour: number): boolean {
  return dayOfWeek === 1 && hour === 5; // Monday 9am UAE
}

// Check if DevOps should run (every hour)
export function isDevOpsTime(minute: number): boolean {
  return minute < 15; // Run in the first 15-min window of each hour
}

// Calculate jitter delay in ms (0 to 3 minutes)
export function getJitterDelay(role: string, cycleNumber: number): number {
  const hash = simpleHash(`${role}-jitter-${cycleNumber}`);
  return (hash % 180) * 1000; // 0-180 seconds
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
