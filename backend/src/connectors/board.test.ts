import supertest from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import type { BoardConnector } from './board';
import { JiraBoardConnector } from './board';
import { createSeedStore } from '../store';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('JiraBoardConnector', () => {
  it('maps Jira search results into syncable issue records', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 1,
          issues: [
            {
              id: '9001',
              key: 'OPS-7',
              fields: {
                summary: 'Investigate alert',
                description: {
                  type: 'doc',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Useful details' }] }],
                },
                status: { name: 'In Progress' },
                assignee: { accountId: 'acct-1' },
                labels: ['ops'],
                priority: { name: 'Highest' },
                updated: '2026-07-29T12:00:00.000Z',
                project: { key: 'OPS' },
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const connector = new JiraBoardConnector('https://jira.example', 'bot@example.com', 'not-a-live-secret');

    const result = await connector.syncProject('OPS');

    expect(result.issueCount).toBe(1);
    expect(result.issues[0]).toMatchObject({
      issueId: '9001',
      issueKey: 'OPS-7',
      title: 'Investigate alert',
      description: 'Useful details',
      assigneeExternalId: 'acct-1',
      priority: 'critical',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/rest/api/3/search/jql?'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.stringMatching(/^Basic /) }) }),
    );
  });
});

describe('board connector API loop', () => {
  it('routes connect/sync through the adapter and upserts returned Jira issues', async () => {
    const store = createSeedStore();
    const connector: BoardConnector = {
      kind: 'jira',
      connectProject: vi.fn().mockResolvedValue(undefined),
      syncProject: vi.fn().mockResolvedValue({
        issueCount: 1,
        issues: [{
          issueId: '99001',
          issueKey: 'NEW-1',
          projectId: 'NEW',
          title: 'Synced from Jira',
          description: 'Remote body',
          status: 'To Do',
          assigneeExternalId: null,
          labels: ['jira'],
          priority: 'high',
          updatedAt: '2026-07-29T12:00:00.000Z',
        }],
      }),
      addComment: vi.fn().mockResolvedValue({ commentId: 'comment-1' }),
      addAttachment: vi.fn().mockResolvedValue({ attachmentId: 'attachment-1' }),
    };
    const req = supertest(createApp({ store, boardConnector: connector }));
    const login = await req.post('/api/v1/auth/login').send({ identity: 'root' }).expect(200);
    const bearer = { Authorization: `Bearer ${login.body.session.token as string}` };

    await req.post('/api/v1/boards/connect').set(bearer).send({ projectId: 'new', name: 'New board' }).expect(201);
    await req.post('/api/v1/boards/NEW/sync').set(bearer).expect(200);

    expect(connector.connectProject).toHaveBeenCalledWith('NEW', 'New board');
    expect(connector.syncProject).toHaveBeenCalledWith('NEW');
    expect(store.workItems.find((item) => item.board.issueKey === 'NEW-1')).toMatchObject({
      title: 'Synced from Jira',
      priority: 'high',
    });
  });

  it('writes both artifacts and a review comment through the adapter', async () => {
    const store = createSeedStore();
    let attachment = 0;
    const connector: BoardConnector = {
      kind: 'jira',
      connectProject: vi.fn().mockResolvedValue(undefined),
      syncProject: vi.fn().mockResolvedValue({ issueCount: 0, issues: [] }),
      addComment: vi.fn().mockResolvedValue({ commentId: 'comment-1' }),
      addAttachment: vi.fn().mockImplementation(async () => ({ attachmentId: `attachment-${++attachment}` })),
    };
    const req = supertest(createApp({ store, boardConnector: connector }));
    const login = await req.post('/api/v1/auth/login').send({ identity: 'root' }).expect(200);

    const result = await req
      .post('/api/v1/work-items/wi-100x-101/triage')
      .set('Authorization', `Bearer ${login.body.session.token as string}`)
      .send({ aiFirst: true })
      .expect(200);

    expect(connector.addAttachment).toHaveBeenCalledTimes(2);
    expect(connector.addComment).toHaveBeenCalledTimes(1);
    expect(result.body.job.artifacts.map((item: { boardAttachmentId: string }) => item.boardAttachmentId))
      .toEqual(['attachment-1', 'attachment-2']);
    expect(store.auditEvents.some((event) => event.action === 'board.writeback.completed')).toBe(true);
  });
});
