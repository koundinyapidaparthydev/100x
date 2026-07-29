import { useState } from 'react';
import { motion, useMotionValue, useTransform, useAnimation, type PanInfo } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Layers } from 'lucide-react';
import { api } from '@shared/api';
import type { WorkItem } from '@shared/types';
import { cn } from '../lib/utils';
import { useAsync } from '../lib/useAsync';
import { timeAgo } from '../lib/format';
import { aiStatusChip, priorityChip } from '../lib/chips';
import { LoadingState, ErrorState, EmptyState } from '../components/States';

const TARGET_PRESETS = [10, 20, 30];

export function Triage() {
  const navigate = useNavigate();
  const { data, error, loading, retry } = useAsync(() => api.listWorkItems());
  const [target, setTarget] = useState(20);
  const [decidedIds, setDecidedIds] = useState<string[]>([]);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped to remount the top card (snap back to center) when a decision fails.
  const [cardEpoch, setCardEpoch] = useState(0);

  // The triage queue: tickets AI has not touched yet and not decided this session.
  const queue = (data ?? []).filter((w) => w.aiStatus === 'none' && !decidedIds.includes(w.id));
  const current = queue[0];

  const handleDecision = async (item: WorkItem, decision: 'ai' | 'human') => {
    setDecisionError(null);
    setBusy(true);
    try {
      await api.triageWorkItem(
        item.id,
        decision === 'ai' ? { aiFirst: true, targetCompletionPercent: target } : { aiFirst: false },
      );
      if (decision === 'ai') {
        navigate(`/app/ticket/${item.id}`);
      } else {
        setDecidedIds((ids) => [...ids, item.id]);
      }
    } catch (e) {
      setDecisionError(e instanceof Error ? e.message : 'Triage decision failed. Try again.');
      setCardEpoch((n) => n + 1); // snap the card back
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden bg-background">
      {/* Target completion % segmented control (policy estimate: 10 / 20 / 30) */}
      <div className="px-4 py-2 flex flex-col items-center gap-1 border-b border-outline-variant bg-surface-container-lowest">
        <div className="flex bg-surface-container-high rounded-full p-1">
          {TARGET_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setTarget(preset)}
              className={cn(
                'px-4 py-1 rounded-full font-mono text-xs transition-colors',
                target === preset
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-variant',
              )}
            >
              {preset}% Target
            </button>
          ))}
        </div>
        <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
          AI completion target applied on swipe right
        </span>
      </div>

      {/* Swipe Deck Area */}
      <div className="flex-1 relative flex items-center justify-center px-4">
        {loading ? (
          <LoadingState label="Loading triage queue…" />
        ) : error ? (
          <ErrorState error={error} onRetry={retry} />
        ) : !current ? (
          <EmptyState
            icon={CheckCircle2}
            title="Queue clear"
            body="No Jira tickets are waiting for an AI-first / human-first decision."
          />
        ) : (
          <>
            {/* Background Hint Cards */}
            {queue.length > 2 && (
              <div className="absolute w-[calc(100%-32px)] max-w-md h-96 bg-surface-container-lowest border border-outline-variant rounded-xl transform scale-95 translate-y-4 opacity-50 z-0"></div>
            )}
            {queue.length > 1 && (
              <div className="absolute w-[calc(100%-32px)] max-w-md h-96 bg-surface-container-lowest border border-outline-variant rounded-xl transform scale-[0.97] translate-y-2 opacity-80 z-10"></div>
            )}

            {/* Active Draggable Card */}
            <SwipeCard
              key={`${current.id}-${cardEpoch}`}
              item={current}
              target={target}
              disabled={busy}
              onDecision={(decision) => void handleDecision(current, decision)}
              onOpen={() => navigate(`/app/ticket/${current.id}`)}
            />
          </>
        )}
      </div>

      {/* Decision error */}
      {decisionError && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-error-container text-on-error-container font-body-sm text-center">
          {decisionError}
        </div>
      )}

      {/* Gesture Hints */}
      <div className="px-4 pb-8 pt-2 flex justify-between items-center">
        <div className="flex flex-col items-center gap-1 opacity-60">
          <ArrowLeft className="w-6 h-6 text-error" />
          <span className="font-mono text-[10px] text-error tracking-[0.1em] uppercase">
            Human-First
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-on-surface-variant opacity-60 uppercase tracking-widest">
          <Layers className="w-3.5 h-3.5" />
          {queue.length > 0 ? `${queue.length} in queue` : 'Swipe to route'}
        </div>
        <div className="flex flex-col items-center gap-1 opacity-60">
          <ArrowRight className="w-6 h-6 text-primary" />
          <span className="font-mono text-[10px] text-primary tracking-[0.1em] uppercase">
            AI-First
          </span>
        </div>
      </div>
    </div>
  );
}

function SwipeCard({
  item,
  target,
  disabled,
  onDecision,
  onOpen,
}: {
  item: WorkItem;
  target: number;
  disabled: boolean;
  onDecision: (decision: 'ai' | 'human') => void;
  onOpen: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const leftOpacity = useTransform(x, [-100, 0], [0.8, 0]);
  const rightOpacity = useTransform(x, [0, 100], [0, 0.8]);
  const controls = useAnimation();

  const priority = priorityChip(item.priority);
  const aiStatus = aiStatusChip(item.aiStatus);

  const handleDragEnd = async (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset > 100 || velocity > 500) {
      // Swiped right → AI-first
      await controls.start({ x: 400, opacity: 0, transition: { duration: 0.2 } });
      onDecision('ai');
    } else if (offset < -100 || velocity < -500) {
      // Swiped left → human-first
      await controls.start({ x: -400, opacity: 0, transition: { duration: 0.2 } });
      onDecision('human');
    } else {
      // Snap back
      controls.start({ x: 0, rotate: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
    }
  };

  return (
    <motion.div
      drag={disabled ? false : 'x'}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      onTap={onOpen}
      style={{ x, rotate }}
      animate={controls}
      whileDrag={{ scale: 1.02 }}
      className="relative w-full max-w-md h-96 bg-surface-container-lowest border border-outline-variant rounded-xl z-20 flex flex-col shadow-lg overflow-hidden cursor-grab active:cursor-grabbing"
    >
      {/* Swipe overlays */}
      <motion.div
        style={{ opacity: leftOpacity }}
        className="absolute inset-0 bg-error/20 pointer-events-none flex items-center justify-center z-30"
      >
        <span className="font-sans font-bold text-3xl text-error opacity-80 transform -rotate-12 border-4 border-error rounded-lg px-4 py-2 uppercase tracking-wider">
          Human
        </span>
      </motion.div>
      <motion.div
        style={{ opacity: rightOpacity }}
        className="absolute inset-0 bg-primary/20 pointer-events-none flex items-center justify-center z-30"
      >
        <span className="font-sans font-bold text-3xl text-primary opacity-80 transform rotate-12 border-4 border-primary rounded-lg px-4 py-2 uppercase tracking-wider">
          AI-First
        </span>
      </motion.div>

      <div className="p-4 flex flex-col h-full bg-surface-container-lowest z-20">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 bg-tertiary-container text-on-tertiary-container rounded font-mono text-[10px] uppercase tracking-widest">
              {item.board.issueKey}
            </span>
            <span className={cn('px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-widest', priority.className)}>
              {priority.label}
            </span>
            <span className={cn('px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-widest', aiStatus.className)}>
              {aiStatus.label}
            </span>
          </div>
          <span className="font-mono text-[10px] text-on-surface-variant whitespace-nowrap pl-2">
            {item.board.projectId}
          </span>
        </div>

        <h2 className="font-headline-sm text-on-surface leading-tight mb-2">{item.title}</h2>

        {/* Body */}
        <p className="font-body-sm text-on-surface-variant line-clamp-4">{item.description}</p>

        {/* Labels */}
        {item.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {item.labels.slice(0, 4).map((label) => (
              <span
                key={label}
                className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-mono text-[10px]"
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Footer Details */}
        <div className="mt-auto pt-4 border-t border-outline-variant flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-on-surface-variant" />
            <span className="font-mono text-[10px] text-on-surface-variant">
              Updated {timeAgo(item.updatedAt)}
            </span>
          </div>
          <span className="font-mono text-[10px] text-primary uppercase tracking-wider">
            Swipe right → AI does {target}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}
