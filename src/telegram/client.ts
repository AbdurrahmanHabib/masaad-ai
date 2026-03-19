const TG_API = 'https://api.telegram.org/bot';

export async function sendMessage(
  botToken: string,
  chatId: string,
  text: string,
  replyToMessageId?: number
): Promise<number | null> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  };
  if (replyToMessageId) body.reply_to_message_id = replyToMessageId;

  const res = await fetch(`${TG_API}${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`Telegram sendMessage failed: ${res.status} ${await res.text()}`);
    return null;
  }

  const data = (await res.json()) as { result?: { message_id: number } };
  return data.result?.message_id || null;
}

export async function sendMessageWithButtons(
  botToken: string,
  chatId: string,
  text: string,
  buttons: Array<{ text: string; callback_data: string }>
): Promise<number | null> {
  const res = await fetch(`${TG_API}${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [buttons.map((b) => ({ text: b.text, callback_data: b.callback_data }))],
      },
    }),
  });

  if (!res.ok) {
    console.error(`Telegram sendMessageWithButtons failed: ${res.status}`);
    return null;
  }

  const data = (await res.json()) as { result?: { message_id: number } };
  return data.result?.message_id || null;
}

export async function setWebhook(botToken: string, url: string): Promise<boolean> {
  const res = await fetch(`${TG_API}${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, allowed_updates: ['message', 'callback_query'] }),
  });
  return res.ok;
}

export async function getMe(botToken: string): Promise<{ ok: boolean; username?: string }> {
  const res = await fetch(`${TG_API}${botToken}/getMe`);
  if (!res.ok) return { ok: false };
  const data = (await res.json()) as { ok: boolean; result?: { username: string } };
  return { ok: data.ok, username: data.result?.username };
}
