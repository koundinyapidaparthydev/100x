import { useMemo, useState } from 'react';
import { GitBranch, MonitorSmartphone, Smartphone, TabletSmartphone } from 'lucide-react';
import { FlowDetailPanel } from '../components/flows/FlowDetailPanel';
import { FlowGraphCanvas } from '../components/flows/FlowGraphCanvas';
import { Button, PageContainer, PageHeader } from '../components/ui';
import {
  FLOW_LAYER_META,
  getFlowGraph,
  type FlowLayer,
  type FlowPlatform,
} from '../lib/flows';
import { cn } from '../lib/utils';

const TABS: { id: FlowPlatform; label: string; icon: typeof MonitorSmartphone }[] = [
  { id: 'web', label: 'Web', icon: MonitorSmartphone },
  { id: 'android', label: 'Android', icon: TabletSmartphone },
  { id: 'ios', label: 'iOS', icon: Smartphone },
];

const ALL_LAYERS = Object.keys(FLOW_LAYER_META) as FlowLayer[];

export default function Flows() {
  const [platform, setPlatform] = useState<FlowPlatform>('web');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [emphasizePrimary, setEmphasizePrimary] = useState(true);
  const [layers, setLayers] = useState<Set<FlowLayer>>(() => new Set(ALL_LAYERS));

  const graph = useMemo(() => getFlowGraph(platform), [platform]);
  const selected = useMemo(
    () => graph.nodes.find((n) => n.id === selectedId) ?? null,
    [graph.nodes, selectedId],
  );

  function toggleLayer(layer: FlowLayer) {
    setLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) {
        if (next.size === 1) return prev;
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return next;
    });
  }

  return (
    <PageContainer data-testid="flows-page" className="max-w-[1600px] space-y-5 pb-10">
      <PageHeader
        eyebrow="Architecture map"
        title="Flows"
        description="Explore how each UI builds and transmits data across Web, Android, and iOS. Zoom, select a module, screenshot it, then ask for a walkthrough MD for that slice."
        actions={
          <Button
            variant="secondary"
            className="gap-2"
            onClick={() => {
              setEmphasizePrimary((v) => !v);
            }}
          >
            <GitBranch size={16} aria-hidden />
            {emphasizePrimary ? 'Primary path on' : 'Primary path off'}
          </Button>
        }
      />

      <div
        role="tablist"
        aria-label="Platform"
        data-testid="flows-platform-tabs"
        className="inline-flex flex-wrap gap-1 rounded-xl border border-outline-variant bg-surface-container p-1"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = platform === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`flows-tab-${tab.id}`}
              onClick={() => {
                setPlatform(tab.id);
                setSelectedId(null);
              }}
              className={cn(
                'inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                active
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
              )}
            >
              <Icon size={16} aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
          Layers
        </span>
        {ALL_LAYERS.map((layer) => {
          const meta = FLOW_LAYER_META[layer];
          const on = layers.has(layer);
          return (
            <button
              key={layer}
              type="button"
              data-testid={`flows-layer-${layer}`}
              onClick={() => toggleLayer(layer)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-semibold transition',
                on ? meta.swatch : 'bg-surface-container text-on-surface-variant opacity-60',
              )}
            >
              {meta.label}
            </button>
          );
        })}
        <button
          type="button"
          className="ml-1 text-xs font-semibold text-primary hover:underline"
          onClick={() => setLayers(new Set(ALL_LAYERS))}
        >
          Show all
        </button>
      </div>

      <div className="rounded-xl border border-outline-variant/80 bg-surface px-4 py-3">
        <h2 className="text-base font-semibold text-on-surface">{graph.title}</h2>
        <p className="mt-1 max-w-[90ch] text-sm leading-6 text-on-surface-variant">{graph.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <FlowGraphCanvas
          graph={graph}
          selectedId={selectedId}
          onSelect={setSelectedId}
          visibleLayers={layers}
          emphasizePrimary={emphasizePrimary}
        />
        <FlowDetailPanel
          node={selected}
          platformLabel={TABS.find((t) => t.id === platform)?.label ?? platform}
        />
      </div>
    </PageContainer>
  );
}
