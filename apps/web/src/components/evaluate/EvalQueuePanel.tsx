import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { db } from '@/db';
import type { Plan, Run } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(startedAt: Date, completedAt: Date | null): string {
	if (!completedAt) return '—';
	const ms = completedAt.getTime() - startedAt.getTime();
	if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
	const mins = Math.floor(ms / 60_000);
	const secs = Math.round((ms % 60_000) / 1000);
	return `${mins}m ${secs}s`;
}

// ─── Strategy badge ───────────────────────────────────────────────────────────

const STRATEGY_CONFIG = {
	rate: { label: 'Rate', className: 'bg-info/15 text-info' },
	compare: { label: 'Compare', className: 'bg-chart-8/15 text-chart-8' },
} as const;

function StrategyBadge({ strategy }: { strategy: 'rate' | 'compare' }) {
	const { label, className } = STRATEGY_CONFIG[strategy];
	return (
		<span
			className={cn(
				'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0',
				className
			)}
		>
			{label}
		</span>
	);
}

// ─── Queue item ───────────────────────────────────────────────────────────────

interface QueueItem {
	run: Run;
	plan: Plan;
	remaining: number;
}

// ─── Queue row ────────────────────────────────────────────────────────────────

interface RowProps {
	item: QueueItem;
	isActive: boolean;
	onClick: () => void;
}

function QueueRow({ item, isActive, onClick }: RowProps) {
	const { run, plan, remaining } = item;
	const isDone = remaining === 0;
	const elapsed = formatElapsed(run.startedAt, run.completedAt);
	const strategy = plan.evalStrategy as 'rate' | 'compare';

	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				'w-full text-left px-4 py-3 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
				isActive ? 'bg-accent' : 'hover:bg-muted/50',
				isDone && 'opacity-50'
			)}
		>
			{/* Line 1: plan name */}
			<p className="text-sm font-medium text-foreground truncate mb-1">
				{plan.name}
			</p>

			{/* Line 2: strategy badge + elapsed + remaining */}
			<div className="flex items-center gap-2">
				<StrategyBadge strategy={strategy} />
				<span className="text-[11px] text-muted-foreground">
					{elapsed}
				</span>
				<span className="ml-auto text-[11px] shrink-0">
					{isDone ? (
						<span className="text-success font-medium">Done</span>
					) : (
						<span className="text-muted-foreground">
							{remaining} left
						</span>
					)}
				</span>
			</div>
		</button>
	);
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function EvalQueuePanel() {
	const navigate = useNavigate();

	// Detect active run from the current URL path
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	const activeRunId = pathname.match(/^\/evaluate\/([^/]+)$/)?.[1] ?? null;

	const items = useLiveQuery(async () => {
		// Load all complete runs
		const runs = await db.runs.where('status').equals('complete').toArray();
		if (runs.length === 0) return [];

		// Load plans for these runs
		const planIds = [...new Set(runs.map((r) => r.planId))];
		const plans = await db.plans.where('id').anyOf(planIds).toArray();
		const planMap = new Map(plans.map((p) => [p.id, p]));

		// Keep only Rate/Compare runs (Parse is auto-judged)
		const evalRuns = runs.filter((r) => {
			const s = planMap.get(r.planId)?.evalStrategy;
			return s === 'rate' || s === 'compare';
		});
		if (evalRuns.length === 0) return [];

		// Compute remaining unevaluated count per run
		const result: QueueItem[] = await Promise.all(
			evalRuns.map(async (run) => {
				const plan = planMap.get(run.planId)!;
				let remaining: number;

				if (plan.evalStrategy === 'rate') {
					const trials = await db.trials
						.where('runId')
						.equals(run.id)
						.toArray();
					const ratedCount = await db.ratings
						.where('trialId')
						.anyOf(trials.map((t) => t.id))
						.count();
					remaining = trials.length - ratedCount;
				} else {
					// compare: one Ranking record per inputIndex
					const rankedCount = await db.rankings
						.where('runId')
						.equals(run.id)
						.count();
					remaining = plan.inputs.length - rankedCount;
				}

				return { run, plan, remaining };
			})
		);

		// Newest run first
		return result.sort(
			(a, b) => b.run.startedAt.getTime() - a.run.startedAt.getTime()
		);
	});

	async function handleSelect(runId: string) {
		console.log('[EvalQueuePanel] Selected run:', runId);
		await navigate({ to: '/evaluate/$runId', params: { runId } });
	}

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="px-4 py-3 border-b border-border shrink-0">
				<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
					Evaluation Queue
				</p>
			</div>

			{!items || items.length === 0 ? (
				<div className="flex-1 flex items-center justify-center text-center px-4 text-muted-foreground text-sm">
					{items === undefined
						? 'Loading…'
						: 'No runs awaiting evaluation'}
				</div>
			) : (
				<div className="flex-1 overflow-y-auto divide-y divide-border">
					{items.map((item) => (
						<QueueRow
							key={item.run.id}
							item={item}
							isActive={item.run.id === activeRunId}
							onClick={() => handleSelect(item.run.id)}
						/>
					))}
				</div>
			)}
		</div>
	);
}
