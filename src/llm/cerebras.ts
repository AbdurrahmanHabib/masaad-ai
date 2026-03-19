const CEREBRAS_API = 'https://api.cerebras.ai/v1/chat/completions';

export async function callCerebras(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 1024
): Promise<{ content: string; tokens_used: number } | null> {
  const res = await fetch(CEREBRAS_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Cerebras API error ${res.status}: ${errText}`);
    return null;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };

  const text = data.choices?.[0]?.message?.content;
  if (!text) return null;

  return {
    content: text,
    tokens_used: data.usage?.total_tokens || 0,
  };
}
