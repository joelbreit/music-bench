import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from '@tanstack/react-router';
import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/db';
import MusicRenderer from '@/components/music/MusicRenderer';
import type { Model, Plan, Provider, Run, Trial } from '@/types';

// ─── Model badge ──────────────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<Provider, string> = {
	anthropic: 'bg-chart-1/15 text-chart-1',
	openai: 'bg-chart-2/15 text-chart-2',
	other: 'bg-muted text-muted-foreground',
};

function ModelBadge({ name, provider }: { name: string; provider: Provider }) {
	return (
		<span
			className={cn(
				'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium',
				PROVIDER_COLORS[provider]
			)}
		>
			{name}
		</span>
	);
}

// ─── Model column ─────────────────────────────────────────────────────────────

function ModelColumn({
	model,
	trial,
}: {
	model: Model;
	trial: Trial | undefined;
}) {
	const [rawExpanded, setRawExpanded] = useState(false);

	return (
		<div className="w-72 min-w-[272px] flex flex-col gap-3">
			<ModelBadge name={model.name} provider={model.provider} />

			{trial?.output ? (
				<MusicRenderer output={trial.output} />
			) : (
				<div className="rounded-md border border-border px-3 py-6 text-xs text-muted-foreground text-center">
					{trial?.status === 'failed' ? 'Trial failed' : 'No output'}
				</div>
			)}

			<div>
				<button
					type="button"
					onClick={() => setRawExpanded((v) => !v)}
					className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
				>
					<span
						className={cn(
							'transition-transform duration-150',
							rawExpanded && 'rotate-90'
						)}
					>
						▶
					</span>
					Raw output
				</button>
				{rawExpanded && (
					<pre className="mt-2 p-3 bg-muted rounded-md text-xs font-mono text-foreground overflow-auto max-h-48 whitespace-pre-wrap break-all">
						{trial?.output ?? '(no output)'}
					</pre>
				)}
			</div>
		</div>
	);
}

// ─── Ranking widget ───────────────────────────────────────────────────────────

interface RankingWidgetProps {
	initialOrder: string[];
	modelMap: Map<string, Model>;
	onSave: (order: string[]) => void;
}

// Keyed by input — remounts (and resets state) when the input changes.
function RankingWidget({ initialOrder, modelMap, onSave }: RankingWidgetProps) {
	const [order, setOrder] = useState(initialOrder);

	function move(idx: number, dir: -1 | 1) {
		const swap = idx + dir;
		if (swap < 0 || swap >= order.length) return;
		const next = [...order];
		[next[idx], next[swap]] = [next[swap], next[idx]];
		console.log('[RankingWidget] Reordered:', next);
		setOrder(next);
		onSave(next);
	}

	return (
		<div className="space-y-1">
			{order.map((modelId, i) => {
				const model = modelMap.get(modelId);
				return (
					<div
						key={modelId}
						className="flex items-center gap-2 py-1 px-2 rounded-md bg-muted/50"
					>
						<span className="text-xs text-muted-foreground w-5 shrink-0 text-right">
							#{i + 1}
						</span>
						<span className="flex-1 min-w-0 text-sm font-mono text-foreground truncate">
							{model?.name ?? modelId}
						</span>
						<div className="flex gap-0.5">
							<button
								type="button"
								onClick={() => move(i, -1)}
								disabled={i === 0}
								aria-label="Move up"
								className="p-1 rounded hover:bg-muted disabled:opacity-20 disabled:cursor-default transition-colors duration-100"
							>
								<ArrowUp size={12} />
							</button>
							<button
								type="button"
								onClick={() => move(i, 1)}
								disabled={i === order.length - 1}
								aria-label="Move down"
								className="p-1 rounded hover:bg-muted disabled:opacity-20 disabled:cursor-default transition-colors duration-100"
							>
								<ArrowDown size={12} />
							</button>
						</div>
					</div>
				);
			})}
		</div>
	);
}

// ─── Compare Mode ─────────────────────────────────────────────────────────────

interface Props {
	run: Run;
	plan: Plan;
}

export default function CompareMode({ run, plan }: Props) {
	const navigate = useNavigate();
	const [inputIdx, setInputIdx] = useState(0);

	const data = useLiveQuery(async () => {
		const trials = await db.trials.where('runId').equals(run.id).toArray();
		const models = await db.models
			.where('id')
			.anyOf(run.modelIds)
			.toArray();
		const modelMap = new Map(models.map((m) => [m.id, m]));
		const rankings = await db.rankings
			.where('runId')
			.equals(run.id)
			.toArray();
		const rankingMap = new Map(rankings.map((r) => [r.inputIndex, r]));
		return { trials, modelMap, rankingMap };
	}, [run.id]);

	if (!data) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
				Loading…
			</div>
		);
	}

	const { trials, modelMap, rankingMap } = data;
	const totalInputs = plan.inputs.length;
	const rankedCount = rankingMap.size;
	const allRanked = rankedCount === totalInputs;

	const inputTrials = trials.filter((t) => t.inputIndex === inputIdx);

	// Initial ranking order: from DB if exists, otherwise run.modelIds order
	const existingRanking = rankingMap.get(inputIdx);
	const initialOrder = existingRanking
		? [...existingRanking.modelRanks]
				.sort((a, b) => a.rank - b.rank)
				.map((r) => r.modelId)
		: run.modelIds;

	function saveRanking(order: string[]) {
		console.log(
			'[CompareMode] Saving ranking for input',
			inputIdx,
			':',
			order
		);
		db.rankings
			.put({
				runId: run.id,
				inputIndex: inputIdx,
				type: 'ranking',
				modelRanks: order.map((modelId, i) => ({
					modelId,
					rank: i + 1,
				})),
			})
			.catch((err: unknown) =>
				console.error('[CompareMode] Ranking save failed:', err)
			);
	}

	function handleSelectInput(i: number) {
		console.log('[CompareMode] Input selected:', i);
		setInputIdx(i);
	}

	function handleNextInput() {
		console.log('[CompareMode] Next input:', inputIdx + 1);
		setInputIdx((prev) => Math.min(prev + 1, totalInputs - 1));
	}

	async function handleDone() {
		console.log('[CompareMode] Done — all inputs ranked');
		await navigate({ to: '/evaluate' });
	}

	return (
		<div className="flex flex-col h-full overflow-hidden">
			{/* ── Header ── */}
			<div className="px-5 py-3 border-b border-border shrink-0 flex items-center justify-between gap-4">
				<p className="text-sm font-medium text-foreground truncate">
					{plan.name}
				</p>
				<span className="text-xs text-muted-foreground shrink-0">
					{rankedCount} / {totalInputs} inputs ranked
				</span>
			</div>

			<div className="flex flex-1 overflow-hidden">
				{/* ── Input list sidebar ── */}
				<div className="w-44 shrink-0 border-r border-border overflow-y-auto py-1">
					{plan.inputs.map((input, i) => {
						const isRanked = rankingMap.has(i);
						const isActive = i === inputIdx;
						return (
							<button
								key={i}
								type="button"
								onClick={() => handleSelectInput(i)}
								className={cn(
									'w-full text-left px-3 py-2 text-[11px] transition-colors duration-150 flex items-start gap-2',
									isActive
										? 'bg-accent text-foreground'
										: 'hover:bg-muted/50 text-muted-foreground'
								)}
							>
								<span
									className={cn(
										'mt-0.5 shrink-0',
										isRanked
											? 'text-success'
											: 'text-muted-foreground/30'
									)}
								>
									{isRanked ? '✓' : '○'}
								</span>
								<span className="truncate">{input}</span>
							</button>
						);
					})}
				</div>

				{/* ── Main area ── */}
				<div className="flex-1 overflow-y-auto">
					<div className="p-5 space-y-6">
						{/* Current input */}
						<p className="text-xs text-muted-foreground">
							Input{' '}
							<span className="font-medium text-foreground">
								{plan.inputs[inputIdx]}
							</span>
						</p>

						{/* Model columns — horizontal scroll if > 3 models */}
						<div className="overflow-x-auto">
							<div className="flex gap-5 min-w-max pb-1">
								{run.modelIds.map((modelId) => {
									const model = modelMap.get(modelId);
									const trial = inputTrials.find(
										(t) => t.modelId === modelId
									);
									if (!model) return null;
									return (
										<ModelColumn
											key={modelId}
											model={model}
											trial={trial}
										/>
									);
								})}
							</div>
						</div>

						{/* Ranking widget — keyed by input so state resets on navigation */}
						<div>
							<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
								Ranking
							</p>
							<RankingWidget
								key={`${run.id}-${inputIdx}`}
								initialOrder={initialOrder}
								modelMap={modelMap}
								onSave={saveRanking}
							/>
						</div>

						{/* Navigation */}
						<div className="flex items-center justify-end gap-3 pt-2">
							{allRanked ? (
								<button
									type="button"
									onClick={() => void handleDone()}
									className="px-4 py-1.5 rounded-md bg-success text-success-foreground text-sm font-medium hover:bg-success/90 transition-colors duration-150"
								>
									Done
								</button>
							) : (
								<button
									type="button"
									onClick={handleNextInput}
									disabled={inputIdx >= totalInputs - 1}
									className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-30 disabled:cursor-default transition-colors duration-150"
								>
									Next Input
									<ChevronRight size={14} />
								</button>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
