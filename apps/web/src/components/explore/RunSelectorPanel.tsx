import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Download, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/db';
import { exportAllRunResults } from '@/lib/exportResults';
import { importRunResults } from '@/lib/importResults';
import ImportResultsDialog from '@/components/explore/ImportResultsDialog';
import type { RunExportData } from '@/lib/importResults';
import type { EvalStrategy, Plan, Run } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
	const now = new Date();
	const sameYear = date.getFullYear() === now.getFullYear();
	return date.toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		...(sameYear ? {} : { year: 'numeric' }),
	});
}

// ─── Strategy badge ───────────────────────────────────────────────────────────

const STRATEGY_CONFIG: Record<
	EvalStrategy,
	{ label: string; className: string }
> = {
	parse: { label: 'Parse', className: 'bg-muted text-muted-foreground' },
	rate: { label: 'Rate', className: 'bg-info/15 text-info' },
	compare: {
		label: 'Compare',
		className: 'bg-chart-8/15 text-chart-8',
	},
};

function StrategyBadge({ strategy }: { strategy: EvalStrategy }) {
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

// ─── Run row ──────────────────────────────────────────────────────────────────

interface RunItem {
	run: Run;
	plan: Plan;
}

interface RowProps {
	item: RunItem;
	isActive: boolean;
	onClick: () => void;
}

function RunRow({ item, isActive, onClick }: RowProps) {
	const { run, plan } = item;
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				'w-full text-left px-4 py-3 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
				isActive ? 'bg-accent' : 'hover:bg-muted/50'
			)}
		>
			{/* Line 1: plan name + strategy badge */}
			<div className="flex items-center justify-between gap-2 mb-1">
				<span className="text-sm font-medium text-foreground truncate">
					{plan.name}
				</span>
				<StrategyBadge strategy={plan.evalStrategy} />
			</div>

			{/* Line 2: model count + date */}
			<div className="flex items-center gap-2 text-[11px] text-muted-foreground">
				<span>
					{run.modelIds.length} model
					{run.modelIds.length !== 1 ? 's' : ''}
				</span>
				<span className="opacity-40">·</span>
				<span>{formatDate(run.startedAt)}</span>
			</div>
		</button>
	);
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function RunSelectorPanel() {
	const navigate = useNavigate();
	const [importOpen, setImportOpen] = useState(false);
	const [exporting, setExporting] = useState(false);

	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	const activeRunId = pathname.match(/^\/explore\/([^/]+)$/)?.[1] ?? null;

	const items = useLiveQuery(async () => {
		const runs = await db.runs.where('status').equals('complete').toArray();
		if (runs.length === 0) return [];

		const planIds = [...new Set(runs.map((r) => r.planId))];
		const plans = await db.plans.where('id').anyOf(planIds).toArray();
		const planMap = new Map(plans.map((p) => [p.id, p]));

		// Keep only runs that have at least one judgment
		const result = await Promise.all(
			runs.map(async (run): Promise<RunItem | null> => {
				const plan = planMap.get(run.planId);
				if (!plan) return null;

				let hasJudgment: boolean;
				if (plan.evalStrategy === 'compare') {
					const count = await db.rankings
						.where('runId')
						.equals(run.id)
						.count();
					hasJudgment = count > 0;
				} else {
					// parse or rate — judgment is keyed on trialId
					const trialIds = (
						await db.trials.where('runId').equals(run.id).toArray()
					).map((t) => t.id);
					if (trialIds.length === 0) return null;

					const table =
						plan.evalStrategy === 'parse'
							? db.verdicts
							: db.ratings;
					const count = await table
						.where('trialId')
						.anyOf(trialIds)
						.count();
					hasJudgment = count > 0;
				}

				return hasJudgment ? { run, plan } : null;
			})
		);

		return result
			.filter((r): r is RunItem => r !== null)
			.sort(
				(a, b) => b.run.startedAt.getTime() - a.run.startedAt.getTime()
			);
	});

	async function handleSelect(runId: string) {
		console.log('[RunSelectorPanel] Selected run:', runId);
		await navigate({ to: '/explore/$runId', params: { runId } });
	}

	async function handleExportAll() {
		if (!items || items.length === 0) return;
		console.log('[RunSelectorPanel] Exporting all runs:', items.length);
		setExporting(true);
		try {
			await exportAllRunResults(items.map((i) => i.run.id));
		} finally {
			setExporting(false);
		}
	}

	async function handleImport(data: RunExportData) {
		console.log('[RunSelectorPanel] Importing run results');
		const newRunId = await importRunResults(data);
		await navigate({ to: '/explore/$runId', params: { runId: newRunId } });
	}

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
				<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
					Runs
				</p>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={handleExportAll}
						disabled={!items || items.length === 0 || exporting}
						className="flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-default transition-colors duration-150"
						aria-label="Export all results"
					>
						<Download size={12} />
					</button>
					<button
						type="button"
						onClick={() => {
							console.log(
								'[RunSelectorPanel] Opening import dialog'
							);
							setImportOpen(true);
						}}
						className="flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
						aria-label="Import results"
					>
						<Upload size={12} />
					</button>
				</div>
			</div>

			{!items || items.length === 0 ? (
				<div className="flex-1 flex items-center justify-center text-center px-4 text-muted-foreground text-sm">
					{items === undefined ? 'Loading…' : 'No evaluated runs yet'}
				</div>
			) : (
				<div className="flex-1 overflow-y-auto divide-y divide-border">
					{items.map((item) => (
						<RunRow
							key={item.run.id}
							item={item}
							isActive={item.run.id === activeRunId}
							onClick={() => handleSelect(item.run.id)}
						/>
					))}
				</div>
			)}

			<ImportResultsDialog
				open={importOpen}
				onOpenChange={setImportOpen}
				onConfirm={handleImport}
			/>
		</div>
	);
}
