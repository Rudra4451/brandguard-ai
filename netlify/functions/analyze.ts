import type { Config } from '@netlify/functions';
import { DefaultGeminiClient } from '../../api/gemini-client-impl';
import { processAnalyzeRequest } from '../../api/verifier-service';

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 256 KB max limit check
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > 256 * 1024) {
    return new Response(JSON.stringify({ error: 'Payload Too Large: exceeded 256 KB limit' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Malformed JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY || '';
  const geminiClient = apiKey ? new DefaultGeminiClient(apiKey) : null;
  const result = await processAnalyzeRequest(body, geminiClient, Boolean(apiKey));

  return new Response(JSON.stringify(result.data), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = {
  path: '/api/analyze',
};
