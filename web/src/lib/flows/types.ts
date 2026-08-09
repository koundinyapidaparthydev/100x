export type FlowPlatform = 'web' | 'android' | 'ios';

export type FlowLayer = 'ui' | 'client' | 'api' | 'backend' | 'runtime';

export type FlowNodeKind =
  | 'screen'
  | 'gate'
  | 'session'
  | 'client'
  | 'endpoint'
  | 'store'
  | 'pipeline'
  | 'platform';

export type FlowNode = {
  id: string;
  label: string;
  layer: FlowLayer;
  kind: FlowNodeKind;
  /** Short one-liner on the graph */
  summary: string;
  /** How data is constructed at this step */
  constructs: string;
  /** How data is transmitted / next hop */
  transmits: string;
  /** Source file paths (repo-relative) */
  files: string[];
  /** Related API methods or routes */
  apis?: string[];
  /** Screenshot walkthrough hint */
  screenshotHint?: string;
  x: number;
  y: number;
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
  /** Emphasize primary happy-path */
  primary?: boolean;
};

export type FlowGraph = {
  platform: FlowPlatform;
  title: string;
  subtitle: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export const FLOW_LAYER_META: Record<
  FlowLayer,
  { label: string; hint: string; swatch: string }
> = {
  ui: {
    label: 'UI',
    hint: 'Screens the user sees and taps',
    swatch: 'bg-primary-container text-on-primary-container',
  },
  client: {
    label: 'Client',
    hint: 'Session, gates, API wrappers',
    swatch: 'bg-secondary-container text-on-secondary-container',
  },
  api: {
    label: 'API',
    hint: 'HTTP /api/v1 edges',
    swatch: 'bg-mint-container text-on-mint-container',
  },
  backend: {
    label: 'Backend',
    hint: 'Routes + in-memory store',
    swatch: 'bg-butter-container text-on-butter-container',
  },
  runtime: {
    label: 'Runtime',
    hint: 'Orchestrator, model, MCP',
    swatch: 'bg-blush-container text-on-blush-container',
  },
};
