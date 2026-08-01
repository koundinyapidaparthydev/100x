/**
 * ModelRunner — sandbox (CI/default) or OpenAI when OPENAI_API_KEY is set.
 * Source: docs/ai/AI_DELEGATION.md, docs/ai/MODEL_PLATFORM_CONFIG.md
 *
 * Hard rule: callers MUST pass already-sanitized text only.
 */

import type { Policy, WorkItem } from '../../../shared/types';

export interface ModelRunInput {
  workItem: WorkItem;
  /** Already PII-sanitized payload — never pass raw ticket text. */
  sanitized: string;
  /** Already PII-sanitized title (for headings); never use workItem.title raw. */
  sanitizedTitle: string;
  policy: Policy;
  targetCompletionPercent: number;
}

export interface ModelRunResult {
  draft: string;
  provider: string;
  modelId: string;
}

export interface ModelRunner {
  readonly kind: 'sandbox' | 'openai';
  run(input: ModelRunInput): Promise<ModelRunResult>;
}

export class SandboxModelRunner implements ModelRunner {
  readonly kind = 'sandbox' as const;

  async run(input: ModelRunInput): Promise<ModelRunResult> {
    const { workItem, sanitized, sanitizedTitle, targetCompletionPercent, policy } = input;
    const draft = [
      `# AI Draft (${targetCompletionPercent}% target) — ${workItem.board.issueKey}: ${sanitizedTitle}`,
      '',
      '## Understanding',
      `Sanitized ticket payload (${sanitized.length} chars) was analyzed by the sandbox runner.`,
      '',
      '## Draft plan',
      `- Restate scope: ${sanitizedTitle.toLowerCase()}.`,
      '- Identify touched modules and write a failing test sketch.',
      '- Produce a draft patch; leave merge + edge cases to the human assignee.',
      '',
      '## Remaining work (human hand-off)',
      '- Verify assumptions against the real repo.',
      '- Complete implementation past the draft and run full CI.',
    ].join('\n');
    return {
      draft,
      provider: policy.model.provider,
      modelId: policy.model.modelId,
    };
  }
}

export class OpenAiModelRunner implements ModelRunner {
  readonly kind = 'openai' as const;

  constructor(private apiKey: string) {}

  async run(input: ModelRunInput): Promise<ModelRunResult> {
    const { workItem, sanitized, sanitizedTitle, targetCompletionPercent, policy } = input;
    const modelId = policy.model.modelId || 'gpt-4o-mini';
    const system = [
      'You are AplifyAI, an enterprise AI drafting assistant.',
      `Produce a bounded draft toward ~${targetCompletionPercent}% completion of the ticket.`,
      'Do not invent secrets. The payload is already PII-sanitized — treat it as safe.',
      'Respond in Markdown with sections: Understanding, Draft plan, Remaining work.',
    ].join(' ');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId.startsWith('gpt') ? modelId : 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `Ticket ${workItem.board.issueKey}: ${sanitizedTitle}\n\n${sanitized}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`OpenAI request failed: ${res.status} ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const draft = data.choices?.[0]?.message?.content?.trim();
    if (!draft) throw new Error('OpenAI returned empty draft');

    return {
      draft,
      provider: 'openai',
      modelId,
    };
  }
}

export function createModelRunner(): ModelRunner {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (key && !key.startsWith('REPLACE_ME_') && key !== 'DISABLED') {
    return new OpenAiModelRunner(key);
  }
  return new SandboxModelRunner();
}
