/**
 * BoardConnector — Jira (and later Canvas) write-back / sync interface.
 * Source: docs/integrations/JIRA_INTEGRATION.md
 */

import type { WorkItem } from '../../../shared/types';
import { nextId, type Store } from '../store';

export interface BoardAttachmentInput {
  filename: string;
  contentType: string;
  body: string;
}

export interface BoardIssueRecord {
  issueId: string;
  issueKey: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  assigneeExternalId: string | null;
  labels: string[];
  priority: WorkItem['priority'];
  updatedAt: string;
}

export interface BoardConnector {
  readonly kind: 'sandbox' | 'jira';
  connectProject(projectId: string, name: string): Promise<void>;
  syncProject(projectId: string): Promise<{ issueCount: number; issues: BoardIssueRecord[] }>;
  addComment(workItem: WorkItem, body: string): Promise<{ commentId: string }>;
  addAttachment(workItem: WorkItem, file: BoardAttachmentInput): Promise<{ attachmentId: string }>;
}

/** In-process sandbox board — records write-backs on the store for audit/demo. */
export class SandboxBoardConnector implements BoardConnector {
  readonly kind = 'sandbox' as const;

  constructor(private store: Store) {}

  async connectProject(projectId: string, name: string): Promise<void> {
    if (this.store.boards.some((b) => b.projectId === projectId)) return;
    const now = new Date().toISOString();
    this.store.boards.push({ projectId, name, connectedAt: now, lastSyncAt: now });
  }

  async syncProject(projectId: string): Promise<{ issueCount: number; issues: BoardIssueRecord[] }> {
    const board = this.store.boards.find((b) => b.projectId === projectId);
    if (!board) throw new Error(`board not connected: ${projectId}`);
    board.lastSyncAt = new Date().toISOString();
    const issues = this.store.workItems
      .filter((w) => w.board.projectId === projectId)
      .map((w) => ({
        issueId: w.board.issueId,
        issueKey: w.board.issueKey,
        projectId: w.board.projectId,
        title: w.title,
        description: w.description,
        status: w.status,
        assigneeExternalId: w.assigneeExternalId,
        labels: [...w.labels],
        priority: w.priority,
        updatedAt: w.updatedAt,
      }));
    return { issueCount: issues.length, issues };
  }

  async addComment(workItem: WorkItem, body: string): Promise<{ commentId: string }> {
    const commentId = nextId('jcom');
    this.store.notifications.push({
      id: nextId('ntf'),
      kind: 'system',
      title: `Board comment on ${workItem.board.issueKey}`,
      body: body.slice(0, 200),
      createdAt: new Date().toISOString(),
      read: false,
      workItemId: workItem.id,
    });
    return { commentId };
  }

  async addAttachment(
    workItem: WorkItem,
    file: BoardAttachmentInput,
  ): Promise<{ attachmentId: string }> {
    this.store.attachmentCounter += 1;
    const attachmentId = `att-${this.store.attachmentCounter}`;
    // Sandbox: attachment id is enough; content already lives on the AiJob artifact.
    void workItem;
    void file;
    return { attachmentId };
  }
}

/**
 * Jira Cloud REST adapter — activated when JIRA_BASE_URL + JIRA_EMAIL + JIRA_API_TOKEN are set.
 * Falls back to throwing if misconfigured; orchestrator uses sandbox unless kind=jira is chosen.
 */
export class JiraBoardConnector implements BoardConnector {
  readonly kind = 'jira' as const;

  constructor(
    private baseUrl: string,
    private email: string,
    private apiToken: string,
  ) {}

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.email}:${this.apiToken}`).toString('base64')}`;
  }

  async connectProject(projectId: string, _name: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/rest/api/3/project/${encodeURIComponent(projectId)}`, {
      headers: { Authorization: this.authHeader(), Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Jira project lookup failed: ${res.status}`);
    }
  }

  async syncProject(projectId: string): Promise<{ issueCount: number; issues: BoardIssueRecord[] }> {
    const jql = encodeURIComponent(`project = ${projectId} ORDER BY updated DESC`);
    const fields = encodeURIComponent('summary,description,status,assignee,labels,priority,updated,project');
    const res = await fetch(`${this.baseUrl}/rest/api/3/search/jql?jql=${jql}&maxResults=50&fields=${fields}`, {
      headers: { Authorization: this.authHeader(), Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Jira sync failed: ${res.status}`);
    const data = (await res.json()) as {
      total?: number;
      issues?: Array<{
        id?: string;
        key?: string;
        fields?: {
          summary?: string;
          description?: unknown;
          status?: { name?: string };
          assignee?: { accountId?: string };
          labels?: string[];
          priority?: { name?: string };
          updated?: string;
          project?: { key?: string };
        };
      }>;
    };
    const issues = (data.issues ?? []).flatMap((issue): BoardIssueRecord[] => {
      if (!issue.id || !issue.key || !issue.fields?.summary) return [];
      return [{
        issueId: issue.id,
        issueKey: issue.key,
        projectId: issue.fields.project?.key ?? projectId,
        title: issue.fields.summary,
        description: adfToText(issue.fields.description),
        status: issue.fields.status?.name ?? 'To Do',
        assigneeExternalId: issue.fields.assignee?.accountId ?? null,
        labels: issue.fields.labels ?? [],
        priority: normalizePriority(issue.fields.priority?.name),
        updatedAt: issue.fields.updated ?? new Date().toISOString(),
      }];
    });
    return { issueCount: data.total ?? issues.length, issues };
  }

  async addComment(workItem: WorkItem, body: string): Promise<{ commentId: string }> {
    const res = await fetch(
      `${this.baseUrl}/rest/api/3/issue/${encodeURIComponent(workItem.board.issueKey)}/comment`,
      {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(),
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: {
            type: 'doc',
            version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }],
          },
        }),
      },
    );
    if (!res.ok) throw new Error(`Jira comment failed: ${res.status}`);
    const data = (await res.json()) as { id?: string };
    return { commentId: data.id ?? 'unknown' };
  }

  async addAttachment(
    workItem: WorkItem,
    file: BoardAttachmentInput,
  ): Promise<{ attachmentId: string }> {
    const form = new FormData();
    form.append('file', new Blob([file.body], { type: file.contentType }), file.filename);
    const res = await fetch(
      `${this.baseUrl}/rest/api/3/issue/${encodeURIComponent(workItem.board.issueKey)}/attachments`,
      {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(),
          'X-Atlassian-Token': 'no-check',
        },
        body: form,
      },
    );
    if (!res.ok) throw new Error(`Jira attachment failed: ${res.status}`);
    const data = (await res.json()) as Array<{ id?: string }>;
    return { attachmentId: data[0]?.id ?? 'unknown' };
  }
}

function adfToText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown };
  const own = typeof node.text === 'string' ? node.text : '';
  const children = Array.isArray(node.content) ? node.content.map(adfToText).filter(Boolean).join('\n') : '';
  return [own, children].filter(Boolean).join('\n');
}

function normalizePriority(value: string | undefined): WorkItem['priority'] {
  const priority = value?.toLowerCase();
  if (priority === 'critical' || priority === 'highest') return 'critical';
  if (priority === 'high') return 'high';
  if (priority === 'low' || priority === 'lowest') return 'low';
  return 'medium';
}

export function createBoardConnector(store: Store): BoardConnector {
  const base = process.env.JIRA_BASE_URL?.replace(/\/$/, '');
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (base && email && token && !token.startsWith('REPLACE_ME_') && token !== 'DISABLED') {
    return new JiraBoardConnector(base, email, token);
  }
  return new SandboxBoardConnector(store);
}
