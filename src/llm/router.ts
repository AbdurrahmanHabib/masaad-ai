import { Env, LLMResponse } from '../types';
import { callGemini } from './gemini';
import { callGroq } from './groq';
import { callCerebras } from './cerebras';

export async function callLLM(
  env: Env,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 1024
): Promise<LLMResponse> {
  // Try Gemini first (smartest + web grounding + most generous free tier)
  try {
    const result = await callGemini(env.GEMINI_API_KEY, systemPrompt, userPrompt, maxTokens);
    if (result) return { ...result, provider: 'gemini' };
  } catch (e) {
    console.error('Gemini failed:', e);
  }

  // Fallback to Groq
  try {
    const result = await callGroq(env.GROQ_API_KEY, systemPrompt, userPrompt, maxTokens);
    if (result) return { ...result, provider: 'groq' };
  } catch (e) {
    console.error('Groq failed:', e);
  }

  // Tertiary: Cerebras
  try {
    const result = await callCerebras(env.CEREBRAS_API_KEY, systemPrompt, userPrompt, maxTokens);
    if (result) return { ...result, provider: 'cerebras' };
  } catch (e) {
    console.error('Cerebras failed:', e);
  }

  // All providers failed
  return { content: '', provider: 'none', tokens_used: 0 };
}

// Quick decision calls using smaller context (for "should I post?" checks)
export async function quickDecision(
  env: Env,
  prompt: string
): Promise<string> {
  const result = await callLLM(env, 'Respond with only YES or NO.', prompt, 10);
  return result.content.trim().toUpperCase();
}
