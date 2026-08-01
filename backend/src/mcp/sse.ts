/**
 * Extract a JSON-RPC payload from an SSE-style MCP response body.
 * Handles both pure JSON and `data: {...}` event streams.
 */

export function parseMcpResponseBody(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    /* try SSE frames */
  }

  const dataLines: string[] = [];
  for (const line of trimmed.split(/\r?\n/)) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) return trimmed;

  // Prefer the last JSON object that looks like JSON-RPC.
  for (let i = dataLines.length - 1; i >= 0; i -= 1) {
    const chunk = dataLines[i]!;
    if (chunk === '[DONE]') continue;
    try {
      return JSON.parse(chunk) as unknown;
    } catch {
      /* keep scanning */
    }
  }

  // Concatenated multi-line data payload
  try {
    return JSON.parse(dataLines.join('\n')) as unknown;
  } catch {
    return trimmed;
  }
}
