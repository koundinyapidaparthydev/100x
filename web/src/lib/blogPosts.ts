export type BlogTopic = 'enterprise' | 'open-source' | 'workflow' | 'comparison';

export type BlogSection =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'callout'; title: string; text: string }
  | { type: 'table'; caption: string; headers: string[]; rows: string[][] };

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  readingMinutes: number;
  topic: BlogTopic;
  topicLabel: string;
  excerpt: string;
  impact: string;
  sections: BlogSection[];
}

export const BLOG_TOPICS: { id: BlogTopic | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'enterprise', label: 'Enterprise' },
  { id: 'open-source', label: 'Open source' },
  { id: 'workflow', label: 'In practice' },
  { id: 'comparison', label: 'Comparisons' },
];

export const COMPARISON_ROWS = [
  {
    dimension: 'Where AI starts',
    cursorLike: 'Inside the IDE, when a developer asks',
    agentLike: 'On a ticket, when the org assigns an agent',
    100x: 'On the board, before a human is assigned — policy or manager swipe',
  },
  {
    dimension: 'System of record',
    cursorLike: 'The repo + editor session',
    agentLike: 'Agent session + PR',
    100x: 'Jira / board stays authoritative; drafts attach back',
  },
  {
    dimension: 'Governance',
    cursorLike: 'Seat policies, privacy mode, org controls',
    agentLike: 'Enterprise deployment, audit of agent runs',
    100x: 'PII firewall, model/cloud/token budgets, approvals, searchable audit',
  },
  {
    dimension: 'Manager workflow',
    cursorLike: 'Indirect — managers see outcomes later',
    agentLike: 'Ticket → agent → review PR',
    100x: 'Mobile swipe AI-first vs human-first; web for deep review',
  },
  {
    dimension: 'Best fit',
    cursorLike: 'Make the coding you keep faster',
    agentLike: 'Offload high-volume, well-scoped backlog work',
    100x: 'Govern AI share of every ticket across distributed delivery teams',
  },
  {
    dimension: 'Open-source reality',
    cursorLike: 'Maintainers use locally; hard to standardize for contributors',
    agentLike: 'Costly for volunteer orgs; overkill for triage',
    100x: 'Triage + bounded drafts on issues without forcing one IDE or one agent bill',
  },
] as const;

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'enterprise-impact-governed-ai-before-assignment',
    title: 'Enterprise impact: governed AI before the ticket is assigned',
    date: '2026-07-28',
    readingMinutes: 8,
    topic: 'enterprise',
    topicLabel: 'Enterprise',
    excerpt:
      'Distributed delivery already runs through boards. The leverage is not another chat window — it is a controllable AI share of each ticket, with PII, spend, and audit that security will actually accept.',
    impact:
      'Cut time-to-first-progress on routine tickets while keeping customer data and model choice under org policy.',
    sections: [
      {
        type: 'p',
        text: 'Most enterprises already pay twice for the same work: once when a ticket sits untriaged, and again when every engineer invents their own AI workflow. Someone pastes a description into a public chat. Someone else uses an IDE agent with a different model. Spend is opaque. PII risk is real. Managers cannot answer “what did AI already do?”',
      },
      {
        type: 'h2',
        text: 'What we are building',
      },
      {
        type: 'p',
        text: '100x sits between the board (Jira today) and the people who finish the work. Policy or a manager decides whether AI runs first. A PII firewall sanitizes the packet. The orchestrator picks model, cloud, and token ceiling. Bounded artifacts — analysis, plan, draft patch, repro notes — attach back to the ticket. A human continues from a warmer start.',
      },
      {
        type: 'ul',
        items: [
          'Web control plane for boards, policies, runtime, approvals, and audit',
          'Mobile swipe for AI-first vs human-first when managers are away from the desk',
          'Customer-selectable cloud / private paths so data residency is not a slide deck promise',
          'Configurable completion targets (for example 10–30%+) so AI is a share of work, not a black-box takeover',
        ],
      },
      {
        type: 'h2',
        text: 'Where the impact shows up',
      },
      {
        type: 'table',
        caption: 'Realistic enterprise levers (directional, not a vendor benchmark)',
        headers: ['Lever', 'Without governed AI', 'With 100x in front'],
        rows: [
          [
            'Routine bugs / chores',
            'Assignee starts cold; AI used ad hoc',
            'Draft context + first pass already on the ticket',
          ],
          [
            'Offshore / multi-region handoff',
            'Context loss across time zones',
            'Artifacts travel with the board item',
          ],
          [
            'Security & compliance',
            'Shadow AI; hard to prove what left the perimeter',
            'Firewall + approvals + audit before the model',
          ],
          [
            'Token / model spend',
            'Personal seats, no ticket-level budget',
            'Org and project budgets with evidence',
          ],
        ],
      },
      {
        type: 'callout',
        title: 'Impact we aim to create',
        text: 'Not “replace the engineer.” Measurable drop in time-to-first-meaningful-progress on AI-eligible tickets, with a defensible story for CISOs: PII blocked by default, private cloud options, and an audit trail that maps to the board.',
      },
      {
        type: 'h2',
        text: 'How this compares to tools enterprises already buy',
      },
      {
        type: 'p',
        text: 'IDE assistants (Cursor-class) make the coding you keep faster. Autonomous agents (Devin-class) excel when you can hand off well-scoped backlog work and review PRs later. 100x is the control plane that decides when AI touches board work at all — before assignment — under policies delivery and security orgs can share.',
      },
      {
        type: 'p',
        text: 'Many teams will keep IDE agents for interactive coding and still need a governed path for ticket intake. That is the gap we are filling.',
      },
    ],
  },
  {
    slug: 'open-source-impact-triage-without-shadow-ai',
    title: 'Open source impact: triage and drafts without shadow AI',
    date: '2026-07-21',
    readingMinutes: 7,
    topic: 'open-source',
    topicLabel: 'Open source',
    excerpt:
      'Maintainers drown in issues. Contributors already use AI privately. A board-native, bounded AI pass can raise the floor for triage — without forcing every volunteer onto one IDE or one enterprise agent bill.',
    impact:
      'Faster issue triage and clearer first responses while keeping the issue tracker as the public record.',
    sections: [
      {
        type: 'p',
        text: 'Open-source projects feel the same pressure enterprises do, with less budget and more public scrutiny. Issues arrive with incomplete repros. Maintainers ask the same clarifying questions. Contributors paste proprietary-looking snippets into random chat tools. Nobody can see what AI already tried.',
      },
      {
        type: 'h2',
        text: 'What we are building for this reality',
      },
      {
        type: 'p',
        text: 'The same core loop — board → policy or triage → sanitized AI pass → artifacts on the issue → human judgment — maps cleanly to GitHub Issues / Jira-for-OSS style workflows. The point is not a $500/month autonomous engineer for every repo. It is a shared, visible first mile.',
      },
      {
        type: 'ul',
        items: [
          'Summarize and classify incoming issues against templates',
          'Propose repro checklists and missing-info comments',
          'Draft “good first issue” breakdowns maintainers can edit',
          'Keep sensitive attachment handling behind allowlists — even in public projects, secrets slip in',
        ],
      },
      {
        type: 'h2',
        text: 'Impact vs existing platforms',
      },
      {
        type: 'table',
        caption: 'Open-source fit check',
        headers: ['Approach', 'Helps maintainers?', 'Risk / friction'],
        rows: [
          [
            'Personal IDE AI',
            'Yes for the person coding',
            'Invisible to the project; inconsistent quality',
          ],
          [
            'Fully autonomous agent',
            'Yes on narrow chores',
            'Cost and trust; overkill for triage volume',
          ],
          [
            '100x-style board pass',
            'Yes at intake for the whole project',
            'Needs board connector + clear human ownership of merges',
          ],
        ],
      },
      {
        type: 'callout',
        title: 'Impact we aim to create',
        text: 'Raise the median quality of first responses and reduce maintainer toil on duplicates and incomplete reports — while the issue thread remains the transparent record contributors already trust.',
      },
      {
        type: 'h2',
        text: 'What we will not pretend',
      },
      {
        type: 'p',
        text: 'AI will not replace release judgment, code ownership, or community moderation. For open source, success looks like fewer stalled issues and clearer handoffs — not unattended merges to main.',
      },
    ],
  },
  {
    slug: 'how-100x-works-in-real-delivery',
    title: 'How this actually works in a delivery week',
    date: '2026-07-14',
    readingMinutes: 6,
    topic: 'workflow',
    topicLabel: 'In practice',
    excerpt:
      'A concrete walkthrough: ticket lands, manager swipes, PII firewall runs, draft attaches, engineer finishes. Same board. Measurable warmer start.',
    impact:
      'Turn “AI somewhere in the org” into a repeatable ticket path managers can see and tune.',
    sections: [
      {
        type: 'p',
        text: 'Abstract architecture diagrams do not convince delivery leads. A week does. Here is the path we are shipping toward — already visible in the H0/H1 sandbox loop (triage, firewall, audit, web + mobile).',
      },
      {
        type: 'h2',
        text: 'Monday: ticket lands',
      },
      {
        type: 'p',
        text: 'A bug is filed in Jira. 100x syncs it as a work item. Org default says AI-first for “bug” types under a token ceiling. Or a manager on mobile swipes right: Send to AI.',
      },
      {
        type: 'h2',
        text: 'Minutes later: governed pass',
      },
      {
        type: 'ul',
        items: [
          'Connector pulls description, comments, and allowed attachment metadata',
          'PII firewall redacts or blocks restricted fields before any prompt is built',
          'Orchestrator selects model + cloud from project policy',
          'AI produces a bounded packet: summary, suspected area, draft tests or notes toward the completion target',
          'Artifacts attach back; audit events record what ran and what was blocked',
        ],
      },
      {
        type: 'h2',
        text: 'Same day: human finishes',
      },
      {
        type: 'p',
        text: 'An engineer in another region opens the ticket. They see what AI already tried. They use their preferred IDE agent for the interactive coding stretch if they want — that is complementary. The board still owns status, evidence, and handoff.',
      },
      {
        type: 'callout',
        title: 'Why this is more realistic than “agent does the sprint”',
        text: 'We optimize for a configurable share of each ticket (10–30%+), not unsupervised end-to-end shipping. Humans keep architecture, risk, and merge authority. Managers keep the swipe and the budget knobs.',
      },
      {
        type: 'h2',
        text: 'What success looks like Friday',
      },
      {
        type: 'p',
        text: 'Fewer cold starts. Clearer audit answers. Token spend tied to tickets, not tribal knowledge. That is the impact loop — not a slogan about replacing teams.',
      },
    ],
  },
  {
    slug: 'compare-cursor-devin-100x',
    title: 'Cursor, Devin-class agents, and 100x: different jobs',
    date: '2026-07-08',
    readingMinutes: 9,
    topic: 'comparison',
    topicLabel: 'Comparisons',
    excerpt:
      'Name the tools people already know — then be honest about the jobs. IDE speed, autonomous backlog execution, and governed board-first delegation are not the same product.',
    impact:
      'Help buyers pick a stack instead of forcing one vendor to cover every AI workflow.',
    sections: [
      {
        type: 'p',
        text: 'By 2026 the market split is clear in practitioner write-ups: IDE-native assistants scale individuals; autonomous agents scale certain organizational tasks; few products own the governed intake layer that sits on the board before assignment. 100x is aimed at that third job.',
      },
      {
        type: 'h2',
        text: 'Three jobs, not three clones',
      },
      {
        type: 'table',
        caption: 'Job-to-be-done snapshot',
        headers: ['Job', 'Typical tools', '100x stance'],
        rows: [
          [
            'Make interactive coding faster',
            'Cursor, Claude Code, Copilot-class',
            'Complementary — engineers still use these',
          ],
          [
            'Delegate well-scoped backlog to an agent',
            'Devin-class platforms',
            'Adjacent — we focus on board intake + governance, not replacing agent runtimes',
          ],
          [
            'Decide AI-first vs human-first with PII, budget, audit',
            'Mostly missing or bolted on',
            'Core product',
          ],
        ],
      },
      {
        type: 'h2',
        text: 'What we take seriously from each',
      },
      {
        type: 'ul',
        items: [
          'From IDE tools: humans need a fast loop while finishing work — we do not try to own the editor',
          'From autonomous agents: async ticket→artifact is powerful — we insist on policy, PII, and human merge authority before that becomes default',
          'From enterprise buyers: private cloud, SSO, and audit are table stakes — we design the control plane around them',
        ],
      },
      {
        type: 'callout',
        title: 'How we talk about names',
        text: 'We name Cursor- and Devin-class products to orient readers. We do not claim feature parity with either. We claim a clearer place in the stack: governed AI share of board work for distributed teams.',
      },
      {
        type: 'h2',
        text: 'Impact you can defend in a budget meeting',
      },
      {
        type: 'p',
        text: 'If your constraint is individual coding speed, buy IDE seats. If your constraint is a mountain of mechanical migrations, evaluate autonomous agents. If your constraint is inconsistent shadow AI across India/US/AU delivery, leaking PII, and no manager triage surface — that is the 100x conversation.',
      },
    ],
  },
  {
    slug: 'measuring-impact-not-hype',
    title: 'Measuring impact: hours, risk, and warmer starts',
    date: '2026-06-30',
    readingMinutes: 5,
    topic: 'enterprise',
    topicLabel: 'Enterprise',
    excerpt:
      'Skip vanity “AI adoption” scores. Instrument time-to-first-progress, AI-eligible ticket share, blocked PII events, and token spend per project.',
    impact:
      'Give founders and delivery leads a scoreboard that survives a CFO and a CISO in the same room.',
    sections: [
      {
        type: 'p',
        text: 'Impact is only real if you can measure it without inventing a new religion. We recommend four metrics that map to the product we are building.',
      },
      {
        type: 'ul',
        items: [
          'Time-to-first-meaningful-progress on AI-eligible tickets (before vs after AI-first)',
          'Share of tickets that ran AI-first under policy (and share blocked by PII rules)',
          'Token spend per project / per ticket against budget',
          'Approval latency for high-risk exceptions',
        ],
      },
      {
        type: 'h2',
        text: 'A simple planning model',
      },
      {
        type: 'p',
        text: 'If a team closes ~N tickets/week, R% are AI-eligible, and a governed pass saves roughly T hours of cold-start work per eligible ticket, weekly hours returned ≈ N × R × T. That is not a vendor SLA — it is a planning sketch you can sanity-check against your board history. Use the impact explorer on the blog index to try your own numbers.',
      },
      {
        type: 'callout',
        title: 'Honesty clause',
        text: 'If tickets are mostly novel architecture, AI-first savings shrink. If they are chores, regressions, and well-templated bugs, savings compound. Tune eligibility — do not fake a single percentage for the whole portfolio.',
      },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function searchPosts(query: string, topic: BlogTopic | 'all'): BlogPost[] {
  const q = query.trim().toLowerCase();
  return BLOG_POSTS.filter((post) => {
    if (topic !== 'all' && post.topic !== topic) return false;
    if (!q) return true;
    const haystack = [post.title, post.excerpt, post.impact, post.topicLabel, ...post.sections.map((s) => JSON.stringify(s))]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}
