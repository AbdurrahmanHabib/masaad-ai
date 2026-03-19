const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 1024
): Promise<{ content: string; tokens_used: number } | null> {
  const res = await fetch(`${GEMINI_API}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.7,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Gemini API error ${res.status}: ${errText}`);
    return null;
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { totalTokenCount?: number };
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  return {
    content: text,
    tokens_used: data.usageMetadata?.totalTokenCount || 0,
  };
}
