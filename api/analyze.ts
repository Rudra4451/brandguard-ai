import type { IncomingMessage, ServerResponse } from 'node:http';
import { DefaultGeminiClient } from './gemini-client-impl';
import { processAnalyzeRequest } from './verifier-service';

/**
 * Standard Vercel Serverless Function & Node.js HTTP request handler.
 * Reads GEMINI_API_KEY exclusively from process.env.
 * Rejects requests exceeding 256 KB with 413.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // 256 KB max payload limit check
  const MAX_BYTES = 256 * 1024;
  let bodyStr = '';
  let byteCount = 0;

  for await (const chunk of req) {
    byteCount += chunk.length;
    if (byteCount > MAX_BYTES) {
      res.statusCode = 413;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Payload Too Large: exceeded 256 KB limit' }));
      return;
    }
    bodyStr += chunk.toString();
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyStr);
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || '';
  const geminiClient = apiKey ? new DefaultGeminiClient(apiKey) : null;

  const result = await processAnalyzeRequest(body, geminiClient, Boolean(apiKey));

  res.statusCode = result.status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(result.data));
}
