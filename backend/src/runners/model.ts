/**
 * ModelRunner — sandbox (CI/default) or live multi-provider when API keys are set.
 * Source: docs/ai/AI_DELEGATION.md, docs/ai/MODEL_PLATFORM_CONFIG.md
 *
 * Supported live providers: openai, anthropic, openrouter.
 * OpenRouter is the customer-keyed path for DeepSeek, Kimi, Qwen, Grok, Nemotron, etc.
 * Cursor / Composer / internal IDE models are NOT directly customer-keyed here.
 *
 * Hard rule: callers MUST pass already-sanitized text only.
 */

import type { Policy, WorkItem } from '../../../shared/types';

export type LiveModelProvider = 'openai' | 'anthropic' | 'openrouter';

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
  readonly kind: 'sandbox' | 'openai' | 'multi';
  /** Which live providers have usable keys (empty for sandbox). */
  readonly configuredProviders?: readonly LiveModelProvider[];
  run(input: ModelRunInput): Promise<ModelRunResult>;
}

export interface ProviderCredentials {
  apiKey: string;
  baseUrl?: string;
}

export interface ModelPlatformConfig {
  openai?: ProviderCredentials;
  anthropic?: ProviderCredentials;
  openrouter?: ProviderCredentials;
}

/** Auto / missing-key resolution order. */
export const AUTO_PROVIDER_PRIORITY: readonly LiveModelProvider[] = [
  'openai',
  'anthropic',
  'openrouter',
];

const DEFAULT_MODELS: Record<LiveModelProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-20250514',
  openrouter: 'openai/gpt-4o-mini',
};

/** Vendor nicknames that route through OpenRouter when keyed that way. */
const OPENROUTER_ALIASES: Record<string, string> = {
  deepseek: 'deepseek/deepseek-chat',
  kimi: 'moonshotai/kimi-k2',
  moonshot: 'moonshotai/kimi-k2',
  qwen: 'qwen/qwen-2.5-72b-instruct',
  grok: 'x-ai/grok-3-mini',
  nemotron: 'nvidia/llama-3.1-nemotron-70b-instruct',
  nvidia: 'nvidia/llama-3.1-nemotron-70b-instruct',
};

function isUsableKey(value: string | undefined): value is string {
  const key = value?.trim();
  if (!key) return false;
  if (key === 'DISABLED') return false;
  if (key.startsWith('REPLACE_ME_')) return false;
  return true;
}

function trimBase(url: string | undefined): string | undefined {
  const v = url?.trim();
  if (!v) return undefined;
  return v.replace(/\/+$/, '');
}

export function readModelPlatformConfig(
  env: NodeJS.ProcessEnv = process.env,
): ModelPlatformConfig {
  const cfg: ModelPlatformConfig = {};
  if (isUsableKey(env.OPENAI_API_KEY)) {
    cfg.openai = {
      apiKey: env.OPENAI_API_KEY.trim(),
      baseUrl: trimBase(env.OPENAI_BASE_URL) ?? 'https://api.openai.com/v1',
    };
  }
  if (isUsableKey(env.ANTHROPIC_API_KEY)) {
    cfg.anthropic = {
      apiKey: env.ANTHROPIC_API_KEY.trim(),
      baseUrl: trimBase(env.ANTHROPIC_BASE_URL) ?? 'https://api.anthropic.com',
    };
  }
  if (isUsableKey(env.OPENROUTER_API_KEY)) {
    cfg.openrouter = {
      apiKey: env.OPENROUTER_API_KEY.trim(),
      baseUrl: trimBase(env.OPENROUTER_BASE_URL) ?? 'https://openrouter.ai/api/v1',
    };
  }
  return cfg;
}

export function listConfiguredProviders(cfg: ModelPlatformConfig): LiveModelProvider[] {
  return AUTO_PROVIDER_PRIORITY.filter((p) => Boolean(cfg[p]));
}

export interface ResolvedModelTarget {
  provider: LiveModelProvider;
  modelId: string;
  endpoint?: string;
}

/**
 * Resolve policy.model into a concrete live provider + model id.
 * Throws when a specific provider is requested but not configured.
 * Returns null when auto has no keys (caller should use sandbox).
 */
export function resolveModelTarget(
  policy: Policy,
  cfg: ModelPlatformConfig,
): ResolvedModelTarget | null {
  const rawProvider = (policy.model.provider || 'auto').trim().toLowerCase();
  const rawModel = (policy.model.modelId || '').trim();
  const endpoint = policy.model.endpoint?.trim() || undefined;
  const configured = listConfiguredProviders(cfg);

  if (rawProvider === 'auto' || rawProvider === '') {
    const provider = configured[0];
    if (!provider) return null;
    const modelId =
      !rawModel || rawModel.toLowerCase() === 'auto'
        ? DEFAULT_MODELS[provider]
        : rawModel;
    return { provider, modelId, endpoint };
  }

  const aliasDefault = OPENROUTER_ALIASES[rawProvider];
  if (aliasDefault) {
    if (!cfg.openrouter) {
      throw new Error(
        `Provider "${rawProvider}" routes via OpenRouter; set OPENROUTER_API_KEY (or pick openai/anthropic).`,
      );
    }
    const modelId =
      !rawModel || rawModel.toLowerCase() === 'auto' ? aliasDefault : rawModel;
    return { provider: 'openrouter', modelId, endpoint };
  }

  if (rawProvider !== 'openai' && rawProvider !== 'anthropic' && rawProvider !== 'openrouter') {
    throw new Error(
      `Unsupported model provider "${rawProvider}". Use auto, openai, anthropic, openrouter, or an OpenRouter alias (deepseek, kimi, qwen, grok, nemotron).`,
    );
  }

  if (!cfg[rawProvider]) {
    const envName =
      rawProvider === 'openai'
        ? 'OPENAI_API_KEY'
        : rawProvider === 'anthropic'
          ? 'ANTHROPIC_API_KEY'
          : 'OPENROUTER_API_KEY';
    throw new Error(`Provider "${rawProvider}" is not configured (set ${envName} on the backend).`);
  }

  const modelId =
    !rawModel || rawModel.toLowerCase() === 'auto' ? DEFAULT_MODELS[rawProvider] : rawModel;
  return { provider: rawProvider, modelId, endpoint };
}

function systemPrompt(targetCompletionPercent: number): string {
  return [
    'You are AplifyAI, an enterprise AI drafting assistant.',
    `Produce a bounded draft toward ~${targetCompletionPercent}% completion of the ticket.`,
    'Do not invent secrets. The payload is already PII-sanitized — treat it as safe.',
    'Respond in Markdown with sections: Understanding, Draft plan, Remaining work.',
  ].join(' ');
}

function userPrompt(input: ModelRunInput): string {
  return `Ticket ${input.workItem.board.issueKey}: ${input.sanitizedTitle}\n\n${input.sanitized}`;
}

async function runOpenAiCompatible(
  creds: ProviderCredentials,
  modelId: string,
  input: ModelRunInput,
  opts?: { referer?: string; title?: string },
): Promise<string> {
  const base = trimBase(creds.baseUrl) ?? 'https://api.openai.com/v1';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${creds.apiKey}`,
    'Content-Type': 'application/json',
  };
  if (opts?.referer) headers['HTTP-Referer'] = opts.referer;
  if (opts?.title) headers['X-Title'] = opts.title;

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: modelId,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt(input.targetCompletionPercent) },
        { role: 'user', content: userPrompt(input) },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Chat completions request failed: ${res.status} ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const draft = data.choices?.[0]?.message?.content?.trim();
  if (!draft) throw new Error('Model returned empty draft');
  return draft;
}

async function runAnthropic(
  creds: ProviderCredentials,
  modelId: string,
  input: ModelRunInput,
): Promise<string> {
  const base = trimBase(creds.baseUrl) ?? 'https://api.anthropic.com';
  const res = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': creds.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 4096,
      temperature: 0.2,
      system: systemPrompt(input.targetCompletionPercent),
      messages: [{ role: 'user', content: userPrompt(input) }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Anthropic request failed: ${res.status} ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const draft = data.content
    ?.filter((block) => block.type === 'text' && block.text)
    .map((block) => block.text)
    .join('\n')
    .trim();
  if (!draft) throw new Error('Anthropic returned empty draft');
  return draft;
}

export class SandboxModelRunner implements ModelRunner {
  readonly kind = 'sandbox' as const;
  readonly configuredProviders = [] as const;

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
      provider: policy.model.provider || 'sandbox',
      modelId: policy.model.modelId || 'sandbox',
    };
  }
}

/** @deprecated Prefer MultiProviderModelRunner; kept for narrow OpenAI-only tests. */
export class OpenAiModelRunner implements ModelRunner {
  readonly kind = 'openai' as const;
  readonly configuredProviders = ['openai'] as const;

  constructor(private apiKey: string, private baseUrl = 'https://api.openai.com/v1') {}

  async run(input: ModelRunInput): Promise<ModelRunResult> {
    const modelId = input.policy.model.modelId || DEFAULT_MODELS.openai;
    const draft = await runOpenAiCompatible(
      { apiKey: this.apiKey, baseUrl: this.baseUrl },
      modelId.startsWith('gpt') || modelId.startsWith('o') ? modelId : DEFAULT_MODELS.openai,
      input,
    );
    return { draft, provider: 'openai', modelId };
  }
}

export class MultiProviderModelRunner implements ModelRunner {
  readonly kind = 'multi' as const;
  readonly configuredProviders: readonly LiveModelProvider[];

  constructor(private cfg: ModelPlatformConfig) {
    this.configuredProviders = listConfiguredProviders(cfg);
    if (this.configuredProviders.length === 0) {
      throw new Error('MultiProviderModelRunner requires at least one configured provider');
    }
  }

  async run(input: ModelRunInput): Promise<ModelRunResult> {
    const target = resolveModelTarget(input.policy, this.cfg);
    if (!target) {
      // Should not happen when constructed with keys; fall back for safety.
      return new SandboxModelRunner().run(input);
    }

    const creds = this.cfg[target.provider];
    if (!creds) {
      throw new Error(`Provider "${target.provider}" is not configured`);
    }

    const effectiveCreds: ProviderCredentials = {
      apiKey: creds.apiKey,
      baseUrl: target.endpoint ?? creds.baseUrl,
    };

    let draft: string;
    if (target.provider === 'anthropic') {
      draft = await runAnthropic(effectiveCreds, target.modelId, input);
    } else if (target.provider === 'openrouter') {
      draft = await runOpenAiCompatible(effectiveCreds, target.modelId, input, {
        referer: process.env.OPENROUTER_HTTP_REFERER?.trim() || 'https://aplify.ai',
        title: process.env.OPENROUTER_APP_TITLE?.trim() || 'AplifyAI',
      });
    } else {
      draft = await runOpenAiCompatible(effectiveCreds, target.modelId, input);
    }

    return {
      draft,
      provider: target.provider,
      modelId: target.modelId,
    };
  }
}

export function createModelRunner(
  env: NodeJS.ProcessEnv = process.env,
): ModelRunner {
  const cfg = readModelPlatformConfig(env);
  const configured = listConfiguredProviders(cfg);
  if (configured.length === 0) {
    return new SandboxModelRunner();
  }
  // Preserve historical kind when only OpenAI is configured (health / logs).
  if (configured.length === 1 && configured[0] === 'openai' && cfg.openai) {
    return new OpenAiModelRunner(cfg.openai.apiKey, cfg.openai.baseUrl);
  }
  return new MultiProviderModelRunner(cfg);
}
