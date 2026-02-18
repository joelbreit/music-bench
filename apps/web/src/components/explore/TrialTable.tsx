import { useState } from 'react';
import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	ChevronDown,
	ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import MusicRenderer from '@/components/music/MusicRenderer';
import type {
	EvalStrategy,
	Model,
	Provider,
	Ranking,
	Rating,
	Trial,
	Verdict,
} from '@/types';

// ─── Model badge ──────────────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<Provider, string> = {
	anthropic: 'bg-chart-1/15 text-chart-1',
	openai: 'bg-chart-2/15 text-chart-2',
	other: 'bg-muted text-muted-foreground',
};

function ModelBadge({ model }: { model: Model | undefined }) {
	if (!model) return <span className="text-xs text-muted-foreground">—</span>;
	return (
		<span
			className={cn(
				'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium shrink-0',
				PROVIDER_COLORS[model.provider]
			)}
		>
			{model.name}
		</span>
	);
}

// ─── Judgment cell ────────────────────────────────────────────────────────────

interface JudgmentCellProps {
	trial: Trial;
	evalStrategy: EvalStrategy;
	verdictMap: Map<string, Verdict>;
	ratingMap: Map<string, Rating>;
	rankingMap: Map<number, Ranking>;
}

function JudgmentCell({
	trial,
	evalStrategy,
	verdictMap,
	ratingMap,
	rankingMap,
}: JudgmentCellProps) {
	if (evalStrategy === 'parse') {
		const v = verdictMap.get(trial.id);
		if (!v) return <span className="text-muted-foreground text-xs">—</span>;
		return (
			<span
				className={cn(
					'text-xs font-medium',
					v.pass ? 'text-success' : 'text-error'
				)}
			>
				{v.pass ? '✓ Pass' : '✗ Fail'}
			</span>
		);
	}

	if (evalStrategy === 'rate') {
		const r = ratingMap.get(trial.id);
		if (!r) return <span className="text-muted-foreground text-xs">—</span>;
		return (
			<span className="text-xs text-foreground">
				{'★'.repeat(r.score)}
				<span className="text-muted-foreground/40">
					{'★'.repeat(5 - r.score)}
				</span>
				<span className="ml-1 text-muted-foreground tabular-nums">
					{r.score}/5
				</span>
			</span>
		);
	}

	// compare
	const ranking = rankingMap.get(trial.inputIndex);
	if (!ranking)
		return <span className="text-muted-foreground text-xs">—</span>;
	const entry = ranking.modelRanks.find((r) => r.modelId === trial.modelId);
	if (!entry) return <span className="text-muted-foreground text-xs">—</span>;
	return (
		<span className="text-xs text-foreground tabular-nums">
			#{entry.rank}
		</span>
	);
}

// ─── Judgment sort value ──────────────────────────────────────────────────────

function judgmentSortValue(
	trial: Trial,
	evalStrategy: EvalStrategy,
	verdictMap: Map<string, Verdict>,
	ratingMap: Map<string, Rating>,
	rankingMap: Map<number, Ranking>
): number {
	if (evalStrategy === 'parse') {
		const v = verdictMap.get(trial.id);
		return v === undefined ? -1 : v.pass ? 1 : 0;
	}
	if (evalStrategy === 'rate') {
		const r = ratingMap.get(trial.id);
		return r?.score ?? -1;
	}
	// compare — lower rank is better; invert so that sort desc = best first
	const ranking = rankingMap.get(trial.inputIndex);
	const entry = ranking?.modelRanks.find((r) => r.modelId === trial.modelId);
	return entry ? -entry.rank : -Infinity;
}

// ─── Sort header ──────────────────────────────────────────────────────────────

type SortKey = 'model' | 'judgment' | 'latency' | 'tokens';
type SortDir = 'asc' | 'desc';

interface SortHeaderProps {
	label: string;
	sortKey: SortKey;
	current: { key: SortKey; dir: SortDir };
	onSort: (key: SortKey) => void;
	className?: string;
}

function SortHeader({
	label,
	sortKey,
	current,
	onSort,
	className,
}: SortHeaderProps) {
	const active = current.key === sortKey;
	return (
		<button
			type="button"
			onClick={() => onSort(sortKey)}
			className={cn(
				'flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors duration-150',
				active && 'text-foreground',
				className
			)}
		>
			{label}
			{active ? (
				current.dir === 'asc' ? (
					<ArrowUp size={10} />
				) : (
					<ArrowDown size={10} />
				)
			) : (
				<ArrowUpDown size={10} className="opacity-40" />
			)}
		</button>
	);
}

// ─── Expanded row ─────────────────────────────────────────────────────────────

function ExpandedRow({ trial }: { trial: Trial }) {
	return (
		<div className="px-4 pb-4 pt-2 space-y-3 bg-muted/20 border-t border-border">
			<div>
				<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
					Input
				</p>
				<p className="text-xs text-foreground whitespace-pre-wrap font-mono">
					{trial.input}
				</p>
			</div>

			{trial.output ? (
				<>
					<div>
						<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
							Output
						</p>
						<pre className="text-xs font-mono text-foreground bg-muted rounded-md p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all">
							{trial.output}
						</pre>
					</div>
					<div>
						<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
							Renderer preview
						</p>
						<MusicRenderer output={trial.output} />
					</div>
				</>
			) : (
				<p className="text-xs text-muted-foreground">No output</p>
			)}
		</div>
	);
}

// ─── Trial Table ──────────────────────────────────────────────────────────────

interface Props {
	evalStrategy: EvalStrategy;
	trials: Trial[];
	modelMap: Map<string, Model>;
	verdictMap: Map<string, Verdict>;
	ratingMap: Map<string, Rating>;
	rankingMap: Map<number, Ranking>;
}

export default function TrialTable({
	evalStrategy,
	trials,
	modelMap,
	verdictMap,
	ratingMap,
	rankingMap,
}: Props) {
	console.log(
		'[TrialTable] trials:',
		trials.length,
		'strategy:',
		evalStrategy
	);

	const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
		key: 'judgment',
		dir: 'desc',
	});
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const [filterModels, setFilterModels] = useState<Set<string>>(new Set());
	const [filterInput, setFilterInput] = useState('');

	// All unique model IDs in this run's trials
	const allModelIds = [...new Set(trials.map((t) => t.modelId))];

	function handleSort(key: SortKey) {
		console.log('[TrialTable] Sort:', key);
		setSort((prev) =>
			prev.key === key
				? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
				: { key, dir: 'desc' }
		);
	}

	function toggleExpanded(trialId: string) {
		console.log('[TrialTable] Toggle expanded:', trialId);
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(trialId)) next.delete(trialId);
			else next.add(trialId);
			return next;
		});
	}

	function toggleModelFilter(modelId: string) {
		console.log('[TrialTable] Toggle model filter:', modelId);
		setFilterModels((prev) => {
			const next = new Set(prev);
			if (next.has(modelId)) next.delete(modelId);
			else next.add(modelId);
			return next;
		});
	}

	// Filter
	const filtered = trials.filter((t) => {
		if (filterModels.size > 0 && !filterModels.has(t.modelId)) return false;
		if (
			filterInput.trim() &&
			!t.input.toLowerCase().includes(filterInput.toLowerCase())
		)
			return false;
		return true;
	});

	// Sort
	const sorted = [...filtered].sort((a, b) => {
		let cmp = 0;
		if (sort.key === 'model') {
			const aName = modelMap.get(a.modelId)?.name ?? a.modelId;
			const bName = modelMap.get(b.modelId)?.name ?? b.modelId;
			cmp = aName.localeCompare(bName);
		} else if (sort.key === 'judgment') {
			const aVal = judgmentSortValue(
				a,
				evalStrategy,
				verdictMap,
				ratingMap,
				rankingMap
			);
			const bVal = judgmentSortValue(
				b,
				evalStrategy,
				verdictMap,
				ratingMap,
				rankingMap
			);
			cmp = aVal - bVal;
		} else if (sort.key === 'latency') {
			cmp = (a.latencyMs ?? -1) - (b.latencyMs ?? -1);
		} else if (sort.key === 'tokens') {
			cmp = (a.tokens ?? -1) - (b.tokens ?? -1);
		}
		return sort.dir === 'asc' ? cmp : -cmp;
	});

	return (
		<div className="flex flex-col overflow-hidden">
			{/* Filter bar */}
			<div className="px-4 py-2.5 border-b border-border shrink-0 flex items-center gap-3 flex-wrap">
				{/* Model filter chips */}
				<div className="flex items-center gap-1.5 flex-wrap">
					{allModelIds.map((modelId) => {
						const model = modelMap.get(modelId);
						const active = filterModels.has(modelId);
						return (
							<button
								key={modelId}
								type="button"
								onClick={() => toggleModelFilter(modelId)}
								className={cn(
									'px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors duration-150',
									active
										? PROVIDER_COLORS[
												model?.provider ?? 'other'
											]
										: 'bg-muted/30 text-muted-foreground hover:bg-muted/60'
								)}
							>
								{model?.name ?? modelId}
							</button>
						);
					})}
				</div>

				<div className="h-3 w-px bg-border shrink-0" />

				{/* Input text search */}
				<input
					type="text"
					placeholder="Filter by input…"
					value={filterInput}
					onChange={(e) => setFilterInput(e.target.value)}
					className="flex-1 min-w-32 max-w-56 text-xs bg-muted/30 border border-border rounded px-2 py-1 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
				/>

				<span className="text-[11px] text-muted-foreground ml-auto shrink-0">
					{sorted.length} of {trials.length}
				</span>
			</div>

			{/* Table */}
			<div className="flex-1 overflow-y-auto">
				<table className="w-full border-collapse text-sm">
					<thead className="sticky top-0 z-10 bg-background border-b border-border">
						<tr>
							<th className="px-3 py-2 text-left w-8" />
							<th className="px-3 py-2 text-left">
								<SortHeader
									label="Model"
									sortKey="model"
									current={sort}
									onSort={handleSort}
								/>
							</th>
							<th className="px-3 py-2 text-left">
								<span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
									Input
								</span>
							</th>
							<th className="px-3 py-2 text-left">
								<SortHeader
									label="Judgment"
									sortKey="judgment"
									current={sort}
									onSort={handleSort}
								/>
							</th>
							<th className="px-3 py-2 text-right">
								<SortHeader
									label="Latency"
									sortKey="latency"
									current={sort}
									onSort={handleSort}
									className="ml-auto"
								/>
							</th>
							<th className="px-3 py-2 text-right">
								<SortHeader
									label="Tokens"
									sortKey="tokens"
									current={sort}
									onSort={handleSort}
									className="ml-auto"
								/>
							</th>
						</tr>
					</thead>
					<tbody>
						{sorted.map((trial, i) => {
							const isExpanded = expanded.has(trial.id);
							return (
								<>
									<tr
										key={trial.id}
										onClick={() => toggleExpanded(trial.id)}
										className={cn(
											'cursor-pointer transition-colors duration-100 border-b border-border/50',
											i % 2 === 0
												? 'bg-background'
												: 'bg-muted/10',
											'hover:bg-accent/30'
										)}
									>
										{/* Expand chevron */}
										<td className="px-3 py-2 text-muted-foreground">
											{isExpanded ? (
												<ChevronDown size={12} />
											) : (
												<ChevronRight size={12} />
											)}
										</td>

										{/* Model */}
										<td className="px-3 py-2">
											<ModelBadge
												model={modelMap.get(
													trial.modelId
												)}
											/>
										</td>

										{/* Input (truncated) */}
										<td className="px-3 py-2 max-w-[200px]">
											<span className="text-xs text-muted-foreground truncate block">
												{trial.input}
											</span>
										</td>

										{/* Judgment */}
										<td className="px-3 py-2">
											<JudgmentCell
												trial={trial}
												evalStrategy={evalStrategy}
												verdictMap={verdictMap}
												ratingMap={ratingMap}
												rankingMap={rankingMap}
											/>
										</td>

										{/* Latency */}
										<td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
											{trial.latencyMs !== null
												? `${trial.latencyMs}ms`
												: '—'}
										</td>

										{/* Tokens */}
										<td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
											{trial.tokens !== null
												? trial.tokens
												: '—'}
										</td>
									</tr>

									{isExpanded && (
										<tr
											key={`${trial.id}-expanded`}
											className={
												i % 2 === 0
													? 'bg-background'
													: 'bg-muted/10'
											}
										>
											<td colSpan={6} className="p-0">
												<ExpandedRow trial={trial} />
											</td>
										</tr>
									)}
								</>
							);
						})}

						{sorted.length === 0 && (
							<tr>
								<td
									colSpan={6}
									className="px-4 py-8 text-center text-sm text-muted-foreground"
								>
									No trials match the current filters
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
