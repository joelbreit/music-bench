import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
	AggregateModelRow,
	AggregateReport,
	EvalStrategy,
	Provider,
} from '@/types';

// ─── Color scale ──────────────────────────────────────────────────────────────

// Interpolates from error-red (score=0) → transparent (score=0.5) → success-green (score=1).
// Works in both dark and light modes at the chosen opacity ceiling.
function scoreToBackground(score: number | null): React.CSSProperties {
	if (score === null) return {};
	const max = 0.28;
	if (score <= 0.5) {
		const t = 1 - score * 2; // 1 at 0, 0 at 0.5
		return { backgroundColor: `rgba(239, 68, 68, ${t * max})` };
	}
	const t = (score - 0.5) * 2; // 0 at 0.5, 1 at 1
	return { backgroundColor: `rgba(34, 197, 94, ${t * max})` };
}

// ─── Provider badge colors ────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<Provider, string> = {
	anthropic: 'bg-chart-1/15 text-chart-1',
	openai: 'bg-chart-2/15 text-chart-2',
	google: 'bg-chart-3/15 text-chart-3',
	xai: 'bg-chart-8/15 text-chart-8',
	deepseek: 'bg-chart-5/15 text-chart-5',
	moonshot: 'bg-chart-7/15 text-chart-7',
	other: 'bg-muted text-muted-foreground',
};

// ─── Strategy short label ─────────────────────────────────────────────────────

const STRATEGY_SHORT: Record<EvalStrategy, string> = {
	parse: 'P',
	rate: 'R',
	compare: 'C',
};

// ─── Sort state ───────────────────────────────────────────────────────────────

type SortKey = 'overall' | string; // string is a planId

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({
	colKey,
	activeSortKey,
	sortDir,
}: {
	colKey: SortKey;
	activeSortKey: SortKey;
	sortDir: 'asc' | 'desc';
}) {
	if (activeSortKey !== colKey)
		return <ArrowUpDown size={10} className="opacity-30" />;
	return sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />;
}

// ─── ScoreMatrix ──────────────────────────────────────────────────────────────

interface Props {
	report: AggregateReport;
}

export default function ScoreMatrix({ report }: Props) {
	const navigate = useNavigate();
	console.log('[ScoreMatrix] rendering', {
		models: report.modelRows.length,
		plans: report.planSummaries.length,
	});

	const [sortKey, setSortKey] = useState<SortKey>('overall');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

	function handleSort(key: SortKey) {
		console.log('[ScoreMatrix] sort by:', key);
		if (key === sortKey) {
			setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		} else {
			setSortKey(key);
			setSortDir('desc');
		}
	}

	function scoreFor(row: AggregateModelRow, key: SortKey): number | null {
		if (key === 'overall') return row.overallScore;
		return row.planScores.find((ps) => ps.planId === key)?.score ?? null;
	}

	const sortedRows = [...report.modelRows].sort((a, b) => {
		const sa = scoreFor(a, sortKey);
		const sb = scoreFor(b, sortKey);
		if (sa === null && sb === null) return 0;
		if (sa === null) return 1;
		if (sb === null) return -1;
		return sortDir === 'asc' ? sa - sb : sb - sa;
	});

	function handleCellClick(runId: string | null) {
		if (!runId) return;
		console.log('[ScoreMatrix] drill-through to run:', runId);
		navigate({ to: '/explore/$runId', params: { runId } });
	}

	const { planSummaries } = report;

	return (
		<div className="flex flex-col overflow-hidden h-full">
			{/* Scroll container — horizontal for many plans */}
			<div className="flex-1 overflow-auto">
				<table className="border-collapse text-xs">
					<thead>
						<tr>
							{/* Model column header — sortable by overall */}
							<th
								className="sticky left-0 top-0 z-30 bg-background border-b border-r border-border px-3 py-2 text-left min-w-44"
								style={{ boxShadow: '1px 0 0 0 var(--border)' }}
							>
								<button
									type="button"
									onClick={() => handleSort('overall')}
									className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors duration-150"
								>
									Model
									<SortIcon
										colKey="overall"
										activeSortKey={sortKey}
										sortDir={sortDir}
									/>
								</button>
							</th>

							{/* One column per plan */}
							{planSummaries.map((ps) => (
								<th
									key={ps.planId}
									className="sticky top-0 z-10 bg-background border-b border-border px-3 py-2 text-left"
									style={{ minWidth: '80px' }}
								>
									<button
										type="button"
										onClick={() => handleSort(ps.planId)}
										className={cn(
											'flex flex-col items-start gap-0.5 text-left w-full',
											'text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-150',
											sortKey === ps.planId &&
												'text-foreground'
										)}
									>
										<span
											className="flex items-center gap-1"
											title={ps.planName}
										>
											<span className="truncate max-w-24">
												{ps.planName}
											</span>
											<SortIcon
												colKey={ps.planId}
												activeSortKey={sortKey}
												sortDir={sortDir}
											/>
										</span>
										<span className="text-[9px] font-normal text-dim-foreground uppercase tracking-wide">
											{STRATEGY_SHORT[ps.evalStrategy]} ·{' '}
											{ps.runCount} run
											{ps.runCount !== 1 ? 's' : ''}
										</span>
									</button>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{sortedRows.map((row, i) => (
							<tr
								key={row.modelId}
								className={cn(
									'border-b border-border/50',
									i % 2 === 0
										? 'bg-background'
										: 'bg-muted/10'
								)}
							>
								{/* Sticky model name cell */}
								<td
									className="sticky left-0 z-10 px-3 py-2 border-r border-border"
									style={{
										backgroundColor:
											i % 2 === 0
												? 'hsl(var(--background))'
												: 'color-mix(in srgb, hsl(var(--muted)) 10%, hsl(var(--background)))',
										boxShadow: '1px 0 0 0 var(--border)',
									}}
								>
									<span
										className={cn(
											'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium',
											PROVIDER_COLORS[
												row.provider as Provider
											]
										)}
									>
										{row.modelName}
									</span>
								</td>

								{/* One score cell per plan */}
								{row.planScores.map((ps, j) => {
									const strategy =
										planSummaries[j]?.evalStrategy ??
										'parse';
									const hasScore = ps.score !== null;
									const canNavigate = ps.runId !== null;

									return (
										<td
											key={ps.planId}
											onClick={() =>
												handleCellClick(ps.runId)
											}
											style={scoreToBackground(ps.score)}
											className={cn(
												'px-3 py-2 text-center align-middle',
												canNavigate
													? 'cursor-pointer hover:ring-1 hover:ring-inset hover:ring-primary/50'
													: 'cursor-default',
												!hasScore && 'bg-muted/20'
											)}
										>
											{hasScore ? (
												<span className="flex flex-col items-center gap-px leading-none">
													<span className="tabular-nums text-foreground">
														{ps.score!.toFixed(2)}
													</span>
													<span className="text-[9px] text-muted-foreground/50 uppercase">
														{
															STRATEGY_SHORT[
																strategy
															]
														}
													</span>
												</span>
											) : (
												<span className="text-muted-foreground/40">
													—
												</span>
											)}
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
