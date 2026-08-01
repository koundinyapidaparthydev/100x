import { describe, expect, it } from 'vitest';
import { parseMcpResponseBody } from './sse';

describe('parseMcpResponseBody', () => {
  it('parses plain JSON', () => {
    expect(parseMcpResponseBody('{"jsonrpc":"2.0","result":{"ok":true}}')).toEqual({
      jsonrpc: '2.0',
      result: { ok: true },
    });
  });

  it('parses SSE data frames', () => {
    const body = [
      'event: message',
      'data: {"jsonrpc":"2.0","id":1,"result":{"content":"hi"}}',
      '',
    ].join('\n');
    expect(parseMcpResponseBody(body)).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { content: 'hi' },
    });
  });
});
