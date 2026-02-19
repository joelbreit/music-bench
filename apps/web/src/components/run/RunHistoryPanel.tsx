import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from '@tanstack/react-router';
import { Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/db';
import { useUIStore } from '@/store';
import type { Run, RunStatus } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(startedAt: Date, completedAt: Date | null): string {
	if (!completedAt) return '—';
	const ms = completedAt.getTime() - startedAt.getTime();
	if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
	const mins = Math.floor(ms / 60_000);
	const secs = Math.round((ms % 60_000) / 1000);
	return `${mins}m ${secs}s`;
}

function formatRelativeTime(date: Date): string {
	const diffMs = Date.now() - date.getTime();
	if (diffMs < 60_000) return 'just now';
	if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
	if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
	return date.toLocaleDateString();
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RunStatus, { label: string; className: string }> = {
	queued: {
		label: 'Queued',
		className: 'bg-muted text-muted-foreground',
	},
	running: {
		label: 'Running',
		className: 'bg-info/15 text-info',
	},
	complete: {
		label: 'Complete',
		className: 'bg-success/15 text-success',
	},
	failed: {
		label: 'Failed',
		className: 'bg-error/15 text-error',
	},
	cancelled: {
		label: 'Cancelled',
		className: 'bg-warning/15 text-warning',
	},
};

function StatusBadge({ status }: { status: RunStatus }) {
	const { label, className } = STATUS_CONFIG[status];
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

// ─── Run row ──────────────────────────────────────────────────────────────────

interface RunRowProps {
	run: Run;
	planName: string;
	trialCount: number;
	progress: { completed: number; total: number } | null;
	onStop: () => void;
	onClick: () => void;
}

function RunRow({
	run,
	planName,
	trialCount,
	progress,
	onStop,
	onClick,
}: RunRowProps) {
	const elapsed = formatElapsed(run.startedAt, run.completedAt);
	const startedAgo = formatRelativeTime(run.startedAt);
	const modelCount = run.modelIds.length;
	const progressPct =
		progress && progress.total > 0
			? Math.round((progress.completed / progress.total) * 100)
			: 0;

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={onClick}
			onKeyDown={(e) => e.key === 'Enter' && onClick()}
			className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
		>
			{/* Line 1: plan name + status badge + stop button */}
			<div className="flex items-center justify-between gap-2 mb-1">
				<span className="text-sm font-medium text-foreground truncate">
					{planName}
				</span>
				<div className="flex items-center gap-1.5 shrink-0">
					<StatusBadge status={run.status} />
					{run.status === 'running' && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onStop();
							}}
							title="Stop run"
							className="flex items-center justify-center w-5 h-5 rounded border border-error/40 bg-error/10 text-error hover:bg-error/20 transition-colors duration-150"
						>
							<Square size={9} />
						</button>
					)}
				</div>
			</div>

			{/* Line 2: metadata */}
			<div className="flex items-center gap-2 text-[11px] text-muted-foreground">
				<span>
					{modelCount} model{modelCount !== 1 ? 's' : ''}
				</span>
				<span className="opacity-40">·</span>
				<span>
					{trialCount} trial{trialCount !== 1 ? 's' : ''}
				</span>
				<span className="opacity-40">·</span>
				{run.status === 'running' && progress ? (
					<span className="text-info">
						{progress.completed} / {progress.total}
					</span>
				) : (
					<span>{elapsed}</span>
				)}
				<span className="opacity-40">·</span>
				<span>{startedAgo}</span>
			</div>

			{/* Progress bar for active run */}
			{run.status === 'running' && progress && (
				<div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
					<div
						className="h-full bg-info rounded-full transition-all duration-300 ease-out"
						style={{ width: `${progressPct}%` }}
					/>
				</div>
			)}
		</div>
	);
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function RunHistoryPanel() {
	const navigate = useNavigate();
	const { runProgressMap, requestCancel } = useUIStore();

	const runs =
		useLiveQuery(() => db.runs.orderBy('startedAt').reverse().toArray()) ??
		[];

	const plans = useLiveQuery(() => db.plans.toArray()) ?? [];
	const planMap = new Map(plans.map((p) => [p.id, p]));

	// Load all trials and count per run. Acceptable at personal-tool scale;
	// revisit if trial counts grow large.
	const allTrials = useLiveQuery(() => db.trials.toArray()) ?? [];
	const trialCountByRun = new Map<string, number>();
	for (const trial of allTrials) {
		trialCountByRun.set(
			trial.runId,
			(trialCountByRun.get(trial.runId) ?? 0) + 1
		);
	}

	async function handleRunClick(runId: string) {
		console.log('[RunHistoryPanel] Navigating to explore run:', runId);
		await navigate({ to: '/explore/$runId', params: { runId } });
	}

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="px-4 py-3 border-b border-border shrink-0">
				<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
					Run History
				</p>
			</div>

			{runs.length === 0 ? (
				<div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
					No runs yet
				</div>
			) : (
				<div className="flex-1 overflow-y-auto divide-y divide-border">
					{runs.map((run) => (
						<RunRow
							key={run.id}
							run={run}
							planName={
								planMap.get(run.planId)?.name ?? 'Unknown plan'
							}
							trialCount={trialCountByRun.get(run.id) ?? 0}
							progress={runProgressMap.get(run.id) ?? null}
							onStop={() => requestCancel(run.id)}
							onClick={() => void handleRunClick(run.id)}
						/>
					))}
				</div>
			)}
		</div>
	);
}
