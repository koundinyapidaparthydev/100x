import { describe, expect, it } from 'vitest';
import type { Policy } from '../../../shared/types';
import {
  createModelRunner,
  listConfiguredProviders,
  readModelPlatformConfig,
  resolveModelTarget,
  SandboxModelRunner,
} from './model';

function policy(provider: string, modelId: string): Policy {
  return {
    model: { provider, modelId },
  } as Policy;
}

describe('readModelPlatformConfig', () => {
  it('ignores placeholder and disabled keys', () => {
    const cfg = readModelPlatformConfig({
      OPENAI_API_KEY: 'REPLACE_ME_openai',
      ANTHROPIC_API_KEY: 'DISABLED',
      OPENROUTER_API_KEY: '  ',
    });
    expect(listConfiguredProviders(cfg)).toEqual([]);
  });

  it('reads usable keys and optional base URLs', () => {
    const cfg = readModelPlatformConfig({
      OPENAI_API_KEY: 'sk-test',
      OPENAI_BASE_URL: 'https://example.com/v1/',
      ANTHROPIC_API_KEY: 'ant-test',
      OPENROUTER_API_KEY: 'or-test',
    });
    expect(listConfiguredProviders(cfg)).toEqual(['openai', 'anthropic', 'openrouter']);
    expect(cfg.openai?.baseUrl).toBe('https://example.com/v1');
  });
});

describe('resolveModelTarget', () => {
  const cfg = readModelPlatformConfig({
    OPENAI_API_KEY: 'sk-test',
    ANTHROPIC_API_KEY: 'ant-test',
    OPENROUTER_API_KEY: 'or-test',
  });

  it('auto picks first configured provider in priority order', () => {
    const target = resolveModelTarget(policy('auto', 'auto'), cfg);
    expect(target).toEqual({
      provider: 'openai',
      modelId: 'gpt-4o-mini',
      endpoint: undefined,
    });
  });

  it('auto with only openrouter uses openrouter defaults', () => {
    const onlyOr = readModelPlatformConfig({ OPENROUTER_API_KEY: 'or-test' });
    const target = resolveModelTarget(policy('auto', 'auto'), onlyOr);
    expect(target?.provider).toBe('openrouter');
    expect(target?.modelId).toBe('openai/gpt-4o-mini');
  });

  it('routes deepseek/kimi/qwen aliases through openrouter', () => {
    expect(resolveModelTarget(policy('deepseek', 'auto'), cfg)).toMatchObject({
      provider: 'openrouter',
      modelId: 'deepseek/deepseek-chat',
    });
    expect(resolveModelTarget(policy('kimi', 'auto'), cfg)).toMatchObject({
      provider: 'openrouter',
      modelId: 'moonshotai/kimi-k2',
    });
    expect(resolveModelTarget(policy('qwen', 'qwen/qwen3-32b'), cfg)).toMatchObject({
      provider: 'openrouter',
      modelId: 'qwen/qwen3-32b',
    });
  });

  it('throws when a specific provider key is missing', () => {
    const openaiOnly = readModelPlatformConfig({ OPENAI_API_KEY: 'sk-test' });
    expect(() => resolveModelTarget(policy('anthropic', 'claude-sonnet-4-20250514'), openaiOnly)).toThrow(
      /ANTHROPIC_API_KEY/,
    );
  });

  it('returns null for auto when nothing is configured', () => {
    expect(resolveModelTarget(policy('auto', 'auto'), {})).toBeNull();
  });
});

describe('createModelRunner', () => {
  it('returns sandbox when no keys', () => {
    const runner = createModelRunner({});
    expect(runner.kind).toBe('sandbox');
    expect(runner).toBeInstanceOf(SandboxModelRunner);
  });

  it('returns openai kind when only OpenAI is configured', () => {
    const runner = createModelRunner({ OPENAI_API_KEY: 'sk-test' });
    expect(runner.kind).toBe('openai');
  });

  it('returns multi when more than one provider is configured', () => {
    const runner = createModelRunner({
      OPENAI_API_KEY: 'sk-test',
      ANTHROPIC_API_KEY: 'ant-test',
    });
    expect(runner.kind).toBe('multi');
    expect(runner.configuredProviders).toEqual(['openai', 'anthropic']);
  });
});

describe('SandboxModelRunner', () => {
  it('returns a draft without calling OpenAI', async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const { createSeedStore } = await import('../store');
    const { applyDemoSeed, DEMO_TICKET_A } = await import('../demoSeed');
    const store = createSeedStore();
    applyDemoSeed(store);
    const item = store.workItems.find((w) => w.id === DEMO_TICKET_A)!;
    const policy = store.policies[0]!;
    const runner = new SandboxModelRunner();
    const result = await runner.run({
      workItem: item,
      sanitized: item.description,
      sanitizedTitle: item.title,
      policy,
      targetCompletionPercent: 20,
    });
    expect(runner.kind).toBe('sandbox');
    expect(result.draft.length).toBeGreaterThan(40);
    expect(result.draft).toContain('MVP-A');
    expect(result.provider).toBeTruthy();
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
  });
});
