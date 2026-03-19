/**
 * Image generation via Gemini Imagen 4.0 API.
 * Used by Marketing AI to create LinkedIn/social media graphics.
 * Returns base64 PNG data.
 */

const IMAGEN_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict';

export async function generateImage(
  apiKey: string,
  prompt: string,
  aspectRatio: '1:1' | '16:9' | '9:16' = '1:1'
): Promise<string | null> {
  const res = await fetch(`${IMAGEN_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio,
        personGeneration: 'dont_allow',
      },
    }),
  });

  if (!res.ok) {
    console.error(`Imagen API error: ${res.status}`);
    return null;
  }

  const data = (await res.json()) as {
    predictions?: Array<{ bytesBase64Encoded?: string }>;
  };

  return data.predictions?.[0]?.bytesBase64Encoded || null;
}

/**
 * Send a photo to a Telegram group.
 * Accepts base64 image data, converts to multipart form upload.
 */
export async function sendTelegramPhoto(
  botToken: string,
  chatId: string,
  imageBase64: string,
  caption: string
): Promise<boolean> {
  // Convert base64 to binary
  const binaryString = atob(imageBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Build multipart form data
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
  const parts: string[] = [];

  // chat_id field
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}`);

  // caption field
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}`);

  // parse_mode field
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\nMarkdown`);

  // Combine text parts
  const textPart = parts.join('\r\n') + '\r\n';

  // Photo file part header
  const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="image.png"\r\nContent-Type: image/png\r\n\r\n`;
  const fileFooter = `\r\n--${boundary}--\r\n`;

  // Combine all parts into a single ArrayBuffer
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(textPart);
  const headerBytes = encoder.encode(fileHeader);
  const footerBytes = encoder.encode(fileFooter);

  const totalLength = textBytes.length + headerBytes.length + bytes.length + footerBytes.length;
  const body = new Uint8Array(totalLength);
  let offset = 0;
  body.set(textBytes, offset); offset += textBytes.length;
  body.set(headerBytes, offset); offset += headerBytes.length;
  body.set(bytes, offset); offset += bytes.length;
  body.set(footerBytes, offset);

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: body,
  });

  return res.ok;
}
