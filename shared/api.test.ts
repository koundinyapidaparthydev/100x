import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, API_BASE } from './api';

function mockFetchOnce(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('targets the single versioned backend base path', () => {
    expect(API_BASE).toBe('/api/v1');
  });

  it('lists work items without filters', async () => {
    const fetchMock = mockFetchOnce(200, []);
    vi.stubGlobal('fetch', fetchMock);

    await api.listWorkItems();
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/work-items', expect.anything());
  });

  it('serializes triage filters as query params', async () => {
    const fetchMock = mockFetchOnce(200, []);
    vi.stubGlobal('fetch', fetchMock);

    await api.listWorkItems({ aiStatus: 'queued', aiFirst: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/work-items?aiStatus=queued&aiFirst=true', expect.anything());
  });

  it('posts triage decisions as JSON', async () => {
    const fetchMock = mockFetchOnce(200, { workItem: { id: 'WI-1' }, job: null });
    vi.stubGlobal('fetch', fetchMock);

    const res = await api.triageWorkItem('WI-1', { aiFirst: true, targetCompletionPercent: 20 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/work-items/WI-1/triage');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ aiFirst: true, targetCompletionPercent: 20 });
    expect(res.workItem.id).toBe('WI-1');
  });

  it('gets and puts onboarding profiles', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ profile: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            profile: {
              plan: 'free',
              completedAt: '2026-01-01T00:00:00.000Z',
              selectedServices: ['jira'],
              otherByCategory: {},
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await api.getOnboarding();
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/onboarding');

    await api.putOnboarding({
      profile: {
        plan: 'free',
        completedAt: '2026-01-01T00:00:00.000Z',
        selectedServices: ['jira'],
        otherByCategory: {},
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/v1/onboarding');
    expect(fetchMock.mock.calls[1]![1].method).toBe('PUT');
  });

  it('throws ApiError with the backend message on failure', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(404, { error: 'Work item not found' }));

    await expect(api.getWorkItem('nope')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Work item not found',
    });
  });

  it('throws ApiError with a fallback message on non-JSON errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));

    const err = (await api.stats().catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
  });
});
