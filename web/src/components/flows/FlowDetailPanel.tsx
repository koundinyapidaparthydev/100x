import { Camera, FileCode2, Link2, Radio } from 'lucide-react';
import { FLOW_LAYER_META, type FlowNode } from '../../lib/flows';
import { cn } from '../../lib/utils';

type Props = {
  node: FlowNode | null;
  platformLabel: string;
};

export function FlowDetailPanel({ node, platformLabel }: Props) {
  if (!node) {
    return (
      <aside
        data-testid="flows-detail-empty"
        className="flex h-full min-h-[520px] flex-col justify-between rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest/70 p-5"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            Module detail
          </p>
          <h2 className="mt-2 text-lg font-semibold text-on-surface">Select a node</h2>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            Zoom into {platformLabel}, click any module, then screenshot this panel + the graph.
            Paste the screenshot in chat and ask to walk that module.
          </p>
        </div>
        <ol className="space-y-2 text-sm text-on-surface-variant">
          <li>1. Pick Web / Android / iOS</li>
          <li>2. Filter layers if the graph feels dense</li>
          <li>3. Click a node → read construct + transmit</li>
          <li>4. Screenshot → request an MD walkthrough</li>
        </ol>
      </aside>
    );
  }

  const meta = FLOW_LAYER_META[node.layer];

  return (
    <aside
      data-testid="flows-detail"
      className="flex h-full min-h-[520px] flex-col gap-4 overflow-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-5"
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', meta.swatch)}>
            {meta.label}
          </span>
          <span className="rounded-md bg-surface-container px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
            {node.kind}
          </span>
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-on-surface">{node.label}</h2>
        <p className="mt-1 text-sm text-on-surface-variant">{node.summary}</p>
        <p className="mt-2 text-xs text-on-surface-variant">{meta.hint}</p>
      </div>

      <section className="rounded-lg border border-outline-variant/80 bg-surface-container-low p-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-on-surface-variant">
          <Radio size={14} aria-hidden />
          How data is constructed
        </div>
        <p className="text-sm leading-6 text-on-surface">{node.constructs}</p>
      </section>

      <section className="rounded-lg border border-outline-variant/80 bg-surface-container-low p-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-on-surface-variant">
          <Link2 size={14} aria-hidden />
          How data is transmitted
        </div>
        <p className="text-sm leading-6 text-on-surface">{node.transmits}</p>
      </section>

      {node.apis && node.apis.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-on-surface-variant">
            APIs / routes
          </p>
          <ul className="space-y-1.5">
            {node.apis.map((api) => (
              <li
                key={api}
                className="rounded-md bg-surface-container px-2.5 py-1.5 font-mono text-[11px] text-on-surface"
              >
                {api}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-on-surface-variant">
          <FileCode2 size={14} aria-hidden />
          Files
        </p>
        <ul className="space-y-1.5">
          {node.files.map((file) => (
            <li
              key={file}
              className="rounded-md border border-outline-variant/70 bg-surface px-2.5 py-1.5 font-mono text-[11px] text-on-surface"
            >
              {file}
            </li>
          ))}
        </ul>
      </section>

      {node.screenshotHint && (
        <section className="mt-auto rounded-lg border border-primary/25 bg-primary-container/60 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-on-primary-container">
            <Camera size={14} aria-hidden />
            Screenshot tip
          </div>
          <p className="text-sm leading-5 text-on-primary-container">{node.screenshotHint}</p>
        </section>
      )}
    </aside>
  );
}
