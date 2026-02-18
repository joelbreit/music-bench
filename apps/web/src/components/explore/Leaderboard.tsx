import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { EvalStrategy, Model, ModelScore, Provider } from '@/types';

// ─── Provider → bar color ──────────────────────────────────────────────────────

const PROVIDER_BAR: Record<Provider, string> = {
	anthropic: 'bg-chart-1',
	openai: 'bg-chart-2',
	other: 'bg-chart-5',
};

const PROVIDER_TEXT: Record<Provider, string> = {
	anthropic: 'text-chart-1',
	openai: 'text-chart-2',
	other: 'text-chart-5',
};

// ─── Strategy label ───────────────────────────────────────────────────────────

const STRATEGY_LABEL: Record<EvalStrategy, string> = {
	parse: 'Pass rate',
	rate: 'Mean rating (normalized)',
	compare: 'Inverse mean rank (normalized)',
};

// ─── Bar row ──────────────────────────────────────────────────────────────────

interface BarRowProps {
	rank: number;
	entry: ModelScore;
	model: Model | undefined;
	targetPct: number; // 0–100, used when mounted
	mounted: boolean;
}

function BarRow({ rank, entry, model, targetPct, mounted }: BarRowProps) {
	const provider: Provider = model?.provider ?? 'other';
	const displayScore =
		entry.score !== null ? `${(entry.score * 100).toFixed(1)}%` : '—';

	return (
		<div className="flex items-center gap-3">
			{/* Rank */}
			<span className="w-5 shrink-0 text-right text-xs text-muted-foreground">
				#{rank}
			</span>

			{/* Model name */}
			<span
				className={cn(
					'w-36 shrink-0 text-xs font-mono truncate',
					PROVIDER_TEXT[provider]
				)}
			>
				{model?.name ?? entry.modelId}
			</span>

			{/* Bar track */}
			<div className="flex-1 h-4 rounded-sm bg-muted/40 overflow-hidden">
				<div
					className={cn('h-full rounded-sm', PROVIDER_BAR[provider])}
					style={{
						width: mounted ? `${targetPct}%` : '0%',
						transition: 'width 500ms ease',
					}}
				/>
			</div>

			{/* Score label */}
			<span className="w-14 shrink-0 text-right text-xs tabular-nums text-foreground">
				{displayScore}
			</span>

			{/* Trial count */}
			<span className="w-16 shrink-0 text-right text-[11px] text-muted-foreground">
				{entry.trialCount} trial{entry.trialCount !== 1 ? 's' : ''}
			</span>
		</div>
	);
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

interface Props {
	runId: string;
	evalStrategy: EvalStrategy;
	modelScores: ModelScore[];
	modelMap: Map<string, Model>;
}

export default function Leaderboard({
	runId,
	evalStrategy,
	modelScores,
	modelMap,
}: Props) {
	console.log('[Leaderboard] runId:', runId, 'strategy:', evalStrategy);

	// Trigger bar animation after first paint
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		const id = setTimeout(() => setMounted(true), 0);
		return () => clearTimeout(id);
	}, []);

	// Sort by score descending (null scores go to bottom)
	const sorted = [...modelScores].sort((a, b) => {
		if (a.score === null && b.score === null) return 0;
		if (a.score === null) return 1;
		if (b.score === null) return -1;
		return b.score - a.score;
	});

	// Max score for relative bar widths (use 1.0 as ceiling so 100% = perfect)
	const maxScore = 1;

	const totalTrials = modelScores.reduce((s, m) => s + m.trialCount, 0);

	return (
		<div className="px-5 py-4 space-y-4">
			{/* Metadata row */}
			<div className="flex items-center gap-4 text-[11px] text-muted-foreground">
				<span className="font-medium uppercase tracking-wide">
					{STRATEGY_LABEL[evalStrategy]}
				</span>
				<span className="opacity-40">·</span>
				<span>{totalTrials} total trials</span>
			</div>

			{/* Bars */}
			<div className="space-y-2.5">
				{sorted.map((entry, i) => (
					<BarRow
						key={entry.modelId}
						rank={i + 1}
						entry={entry}
						model={modelMap.get(entry.modelId)}
						targetPct={
							entry.score !== null
								? (entry.score / maxScore) * 100
								: 0
						}
						mounted={mounted}
					/>
				))}
			</div>
		</div>
	);
}
