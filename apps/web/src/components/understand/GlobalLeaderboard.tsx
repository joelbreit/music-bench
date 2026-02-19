import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { AggregateModelRow, AggregateReport, Provider } from '@/types';

// ─── Provider colors (mirrors Leaderboard.tsx) ────────────────────────────────

const PROVIDER_BAR: Record<Provider, string> = {
	anthropic: 'bg-chart-1',
	openai: 'bg-chart-2',
	google: 'bg-chart-3',
	xai: 'bg-chart-8',
	deepseek: 'bg-chart-5',
	moonshot: 'bg-chart-7',
	other: 'bg-chart-4',
};

const PROVIDER_TEXT: Record<Provider, string> = {
	anthropic: 'text-chart-1',
	openai: 'text-chart-2',
	google: 'text-chart-3',
	xai: 'text-chart-8',
	deepseek: 'text-chart-5',
	moonshot: 'text-chart-7',
	other: 'text-chart-4',
};

// ─── Bar row ──────────────────────────────────────────────────────────────────

interface BarRowProps {
	rank: number;
	row: AggregateModelRow;
	totalPlans: number;
	mounted: boolean;
}

function BarRow({ rank, row, totalPlans, mounted }: BarRowProps) {
	const provider = row.provider as Provider;
	const scoredPlans = row.planScores.filter((ps) => ps.score !== null).length;
	const isPartial = scoredPlans < totalPlans;
	const displayScore =
		row.overallScore !== null ? row.overallScore.toFixed(2) : '—';
	const pct = row.overallScore !== null ? row.overallScore * 100 : 0;

	return (
		<div className="flex items-center gap-3">
			{/* Rank */}
			<span className="w-5 shrink-0 text-right text-xs text-muted-foreground">
				#{rank}
			</span>

			{/* Model name */}
			<span
				className={cn(
					'w-40 shrink-0 text-xs font-mono truncate',
					PROVIDER_TEXT[provider]
				)}
			>
				{row.modelName}
			</span>

			{/* Bar track — dashed border when partial */}
			<div
				className={cn(
					'flex-1 h-4 rounded-sm bg-muted/40 overflow-hidden',
					isPartial &&
						'border border-dashed border-muted-foreground/30'
				)}
			>
				<div
					className={cn('h-full rounded-sm', PROVIDER_BAR[provider])}
					style={{
						width: mounted ? `${pct}%` : '0%',
						transition: 'width 500ms ease',
					}}
				/>
			</div>

			{/* Overall score */}
			<span className="w-10 shrink-0 text-right text-xs tabular-nums text-foreground">
				{displayScore}
			</span>

			{/* Plans contributing */}
			<span className="w-16 shrink-0 text-right text-[11px] text-muted-foreground">
				{scoredPlans} plan{scoredPlans !== 1 ? 's' : ''}
			</span>

			{/* Partial label — always rendered to keep layout stable */}
			<span
				className={cn(
					'w-12 shrink-0 text-[10px] italic',
					isPartial
						? 'text-muted-foreground'
						: 'opacity-0 select-none'
				)}
			>
				partial
			</span>
		</div>
	);
}

// ─── GlobalLeaderboard ────────────────────────────────────────────────────────

interface Props {
	report: AggregateReport;
}

export default function GlobalLeaderboard({ report }: Props) {
	console.log(
		'[GlobalLeaderboard] models:',
		report.modelRows.length,
		'plans:',
		report.planSummaries.length
	);

	// Trigger bar animation after first paint
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		const id = setTimeout(() => setMounted(true), 0);
		return () => clearTimeout(id);
	}, []);

	const totalPlans = report.planSummaries.length;

	if (report.modelRows.length === 0) {
		return (
			<div className="px-5 py-6 text-sm text-muted-foreground">
				No scored runs found for the selected assessments.
			</div>
		);
	}

	return (
		<div className="px-5 py-4 space-y-4">
			{/* Metadata row */}
			<div className="flex items-center gap-4 text-[11px] text-muted-foreground">
				<span className="font-medium uppercase tracking-wide">
					Overall model ranking
				</span>
				<span className="opacity-40">·</span>
				<span>
					{totalPlans} assessment{totalPlans !== 1 ? 's' : ''}
				</span>
				<span className="opacity-40">·</span>
				<span>
					{report.modelRows.length} model
					{report.modelRows.length !== 1 ? 's' : ''}
				</span>
			</div>

			{/* Bar rows — already sorted by T27 */}
			<div className="space-y-2.5">
				{report.modelRows.map((row, i) => (
					<BarRow
						key={row.modelId}
						rank={i + 1}
						row={row}
						totalPlans={totalPlans}
						mounted={mounted}
					/>
				))}
			</div>
		</div>
	);
}
