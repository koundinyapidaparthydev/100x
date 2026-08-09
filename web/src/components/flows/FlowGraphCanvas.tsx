import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { cn } from '../../lib/utils';
import {
  FLOW_LAYER_META,
  type FlowEdge,
  type FlowGraph,
  type FlowLayer,
  type FlowNode,
} from '../../lib/flows';

const NODE_W = 168;
const NODE_H = 78;
const MIN_SCALE = 0.45;
const MAX_SCALE = 2.4;

type Props = {
  graph: FlowGraph;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  visibleLayers: Set<FlowLayer>;
  emphasizePrimary: boolean;
};

function nodeCenter(n: FlowNode) {
  return { x: n.x + NODE_W / 2, y: n.y + NODE_H / 2 };
}

function edgePath(from: FlowNode, to: FlowNode): string {
  const a = nodeCenter(from);
  const b = nodeCenter(to);
  const dx = Math.max(40, Math.abs(b.x - a.x) * 0.35);
  const c1x = a.x + (b.x >= a.x ? dx : -dx);
  const c2x = b.x - (b.x >= a.x ? dx : -dx);
  return `M ${a.x} ${a.y} C ${c1x} ${a.y}, ${c2x} ${b.y}, ${b.x} ${b.y}`;
}

function kindAccent(kind: FlowNode['kind']): string {
  switch (kind) {
    case 'screen':
      return 'border-primary/40';
    case 'gate':
      return 'border-secondary/45';
    case 'session':
      return 'border-secondary/50';
    case 'client':
      return 'border-outline';
    case 'endpoint':
      return 'border-success/45';
    case 'store':
      return 'border-warning/50';
    case 'pipeline':
      return 'border-error/35';
    case 'platform':
      return 'border-primary/55';
  }
}

export function FlowGraphCanvas({
  graph,
  selectedId,
  onSelect,
  visibleLayers,
  emphasizePrimary,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.85);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  const nodeById = useMemo(() => {
    const map = new Map<string, FlowNode>();
    for (const n of graph.nodes) map.set(n.id, n);
    return map;
  }, [graph.nodes]);

  const visibleNodes = useMemo(
    () => graph.nodes.filter((n) => visibleLayers.has(n.layer)),
    [graph.nodes, visibleLayers],
  );

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(
    () =>
      graph.edges.filter((e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to)),
    [graph.edges, visibleNodeIds],
  );

  const bounds = useMemo(() => {
    if (!visibleNodes.length) return { width: 800, height: 600 };
    const maxX = Math.max(...visibleNodes.map((n) => n.x + NODE_W));
    const maxY = Math.max(...visibleNodes.map((n) => n.y + NODE_H));
    return { width: maxX + 80, height: maxY + 80 };
  }, [visibleNodes]);

  useEffect(() => {
    setScale(0.85);
    setPan({ x: 24, y: 24 });
    onSelect(null);
    // Reset view when switching platform graphs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.platform]);

  const relatedIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const ids = new Set<string>([selectedId]);
    for (const e of graph.edges) {
      if (e.from === selectedId) ids.add(e.to);
      if (e.to === selectedId) ids.add(e.from);
    }
    return ids;
  }, [graph.edges, selectedId]);

  function clampScale(next: number) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
  }

  function onWheel(e: ReactWheelEvent) {
    e.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setScale((prev) => {
      const next = clampScale(prev * delta);
      const ratio = next / prev;
      setPan((p) => ({
        x: mx - (mx - p.x) * ratio,
        y: my - (my - p.y) * ratio,
      }));
      return next;
    });
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-flow-node]')) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: pan.x,
      originY: pan.y,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    setPan({ x: d.originX + dx, y: d.originY + dy });
  }

  function onPointerUp(e: ReactPointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.moved) onSelect(null);
    dragRef.current = null;
  }

  function zoomBy(factor: number) {
    const rect = viewportRef.current?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 0;
    const cy = rect ? rect.height / 2 : 0;
    setScale((prev) => {
      const next = clampScale(prev * factor);
      const ratio = next / prev;
      setPan((p) => ({
        x: cx - (cx - p.x) * ratio,
        y: cy - (cy - p.y) * ratio,
      }));
      return next;
    });
  }

  function fitView() {
    const el = viewportRef.current;
    if (!el) return;
    const pad = 48;
    const sx = (el.clientWidth - pad * 2) / bounds.width;
    const sy = (el.clientHeight - pad * 2) / bounds.height;
    const next = clampScale(Math.min(sx, sy, 1));
    setScale(next);
    setPan({
      x: (el.clientWidth - bounds.width * next) / 2,
      y: (el.clientHeight - bounds.height * next) / 2,
    });
  }

  function edgeClass(edge: FlowEdge): string {
    const selected =
      selectedId && (edge.from === selectedId || edge.to === selectedId);
    if (selected) return 'stroke-primary stroke-[2.5] opacity-95';
    if (emphasizePrimary && edge.primary) return 'stroke-primary/70 stroke-[2] opacity-80';
    if (selectedId) return 'stroke-outline-variant stroke-[1.25] opacity-25';
    return 'stroke-outline stroke-[1.5] opacity-55';
  }

  return (
    <div className="relative flex h-full min-h-[520px] flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--color-outline-variant) 80%, transparent) 1px, transparent 0)',
          backgroundSize: '18px 18px',
        }}
        aria-hidden
      />

      <div className="relative z-10 flex flex-wrap items-center gap-2 border-b border-outline-variant/80 bg-surface/85 px-3 py-2 backdrop-blur-sm">
        <span className="mr-1 text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
          Canvas
        </span>
        <button
          type="button"
          className="rounded-md border border-outline-variant bg-surface px-2.5 py-1 text-xs font-semibold text-on-surface hover:bg-surface-container"
          onClick={() => zoomBy(1.15)}
        >
          Zoom in
        </button>
        <button
          type="button"
          className="rounded-md border border-outline-variant bg-surface px-2.5 py-1 text-xs font-semibold text-on-surface hover:bg-surface-container"
          onClick={() => zoomBy(1 / 1.15)}
        >
          Zoom out
        </button>
        <button
          type="button"
          className="rounded-md border border-outline-variant bg-surface px-2.5 py-1 text-xs font-semibold text-on-surface hover:bg-surface-container"
          onClick={fitView}
        >
          Fit
        </button>
        <button
          type="button"
          className="rounded-md border border-outline-variant bg-surface px-2.5 py-1 text-xs font-semibold text-on-surface hover:bg-surface-container"
          onClick={() => {
            setScale(0.85);
            setPan({ x: 24, y: 24 });
          }}
        >
          Reset
        </button>
        <span className="ml-auto font-mono text-[11px] text-on-surface-variant">
          {Math.round(scale * 100)}% · drag to pan · scroll to zoom
        </span>
      </div>

      <div
        ref={viewportRef}
        data-testid="flows-canvas"
        className="relative z-10 flex-1 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="origin-top-left will-change-transform"
          style={{
            width: bounds.width,
            height: bounds.height,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          }}
        >
          <svg
            width={bounds.width}
            height={bounds.height}
            className="absolute inset-0 overflow-visible"
            aria-hidden
          >
            <defs>
              <marker
                id="flow-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-primary)" opacity="0.75" />
              </marker>
            </defs>
            {visibleEdges.map((edge) => {
              const from = nodeById.get(edge.from);
              const to = nodeById.get(edge.to);
              if (!from || !to) return null;
              const selected =
                selectedId && (edge.from === selectedId || edge.to === selectedId);
              return (
                <g key={edge.id}>
                  <path
                    d={edgePath(from, to)}
                    fill="none"
                    className={edgeClass(edge)}
                    markerEnd={selected || (emphasizePrimary && edge.primary) ? 'url(#flow-arrow)' : undefined}
                  />
                  {edge.label && (
                    <text
                      x={(nodeCenter(from).x + nodeCenter(to).x) / 2}
                      y={(nodeCenter(from).y + nodeCenter(to).y) / 2 - 6}
                      className={cn(
                        'fill-on-surface-variant text-[10px]',
                        selectedId && !selected && 'opacity-20',
                      )}
                      textAnchor="middle"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {visibleNodes.map((node) => {
            const selected = node.id === selectedId;
            const dimmed = Boolean(selectedId && !relatedIds.has(node.id));
            const meta = FLOW_LAYER_META[node.layer];
            return (
              <button
                key={node.id}
                type="button"
                data-flow-node
                data-testid={`flow-node-${node.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(node.id);
                }}
                className={cn(
                  'absolute rounded-xl border bg-surface-container-lowest p-2.5 text-left shadow-sm transition',
                  kindAccent(node.kind),
                  selected && 'ring-2 ring-primary ring-offset-2 ring-offset-surface-container-low',
                  dimmed && 'opacity-30',
                )}
                style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
              >
                <span
                  className={cn(
                    'inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                    meta.swatch,
                  )}
                >
                  {meta.label}
                </span>
                <span className="mt-1 block truncate text-[12px] font-semibold leading-4 text-on-surface">
                  {node.label}
                </span>
                <span className="mt-0.5 block truncate text-[10px] leading-3 text-on-surface-variant">
                  {node.summary}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
