import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/db';
import MusicRenderer from '@/components/music/MusicRenderer';
import type { Plan, Provider, Run } from '@/types';

// ─── Provider / model badge ───────────────────────────────────────────────────

const PROVIDER_COLORS: Record<Provider, string> = {
	anthropic: 'bg-chart-1/15 text-chart-1',
	openai: 'bg-chart-2/15 text-chart-2',
	google: 'bg-chart-3/15 text-chart-3',
	xai: 'bg-chart-8/15 text-chart-8',
	deepseek: 'bg-chart-5/15 text-chart-5',
	moonshot: 'bg-chart-7/15 text-chart-7',
	other: 'bg-muted text-muted-foreground',
};

function ModelBadge({ name, provider }: { name: string; provider: Provider }) {
	return (
		<span
			className={cn(
				'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium shrink-0',
				PROVIDER_COLORS[provider]
			)}
		>
			{name}
		</span>
	);
}

// ─── Star rating widget ───────────────────────────────────────────────────────

function StarRating({
	value,
	onChange,
}: {
	value: number | null;
	onChange: (score: number) => void;
}) {
	const [hover, setHover] = useState<number | null>(null);
	const displayed = hover ?? value ?? 0;

	return (
		<div className="flex items-center gap-1.5">
			{[1, 2, 3, 4, 5].map((star) => (
				<button
					key={star}
					type="button"
					aria-label={`Rate ${star} of 5`}
					onClick={() => onChange(star)}
					onMouseEnter={() => setHover(star)}
					onMouseLeave={() => setHover(null)}
					className={cn(
						'text-2xl leading-none transition-colors duration-100 focus-visible:outline-none',
						star <= displayed
							? 'text-warning'
							: 'text-muted-foreground/30 hover:text-muted-foreground/60'
					)}
				>
					★
				</button>
			))}
			{value !== null && (
				<span className="ml-1 text-xs text-muted-foreground">
					{value}/5
				</span>
			)}
		</div>
	);
}

// ─── Rate Mode ────────────────────────────────────────────────────────────────

interface Props {
	run: Run;
	plan: Plan;
}

export default function RateMode({ run }: Props) {
	const navigate = useNavigate();
	const [trialIdx, setTrialIdx] = useState(0);
	const [rawExpanded, setRawExpanded] = useState(false);

	const data = useLiveQuery(async () => {
		const trials = await db.trials.where('runId').equals(run.id).toArray();
		const models = await db.models
			.where('id')
			.anyOf(run.modelIds)
			.toArray();
		const modelMap = new Map(models.map((m) => [m.id, m]));

		// Preserve run.modelIds order, then sort by inputIndex
		const sorted = [...trials].sort((a, b) => {
			const ai = run.modelIds.indexOf(a.modelId);
			const bi = run.modelIds.indexOf(b.modelId);
			return ai !== bi ? ai - bi : a.inputIndex - b.inputIndex;
		});

		const ratings = await db.ratings
			.where('trialId')
			.anyOf(sorted.map((t) => t.id))
			.toArray();
		const ratingMap = new Map(ratings.map((r) => [r.trialId, r.score]));

		return { sorted, modelMap, ratingMap };
	}, [run.id]);

	if (!data) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
				Loading…
			</div>
		);
	}

	const { sorted: trials, modelMap, ratingMap } = data;

	if (trials.length === 0) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
				No trials found for this run
			</div>
		);
	}

	const idx = Math.min(trialIdx, trials.length - 1);
	const trial = trials[idx];
	const model = modelMap.get(trial.modelId);
	const currentRating = ratingMap.get(trial.id) ?? null;
	const total = trials.length;
	const ratedCount = ratingMap.size;
	const allRated = ratedCount === total;

	function handleRate(score: number) {
		console.log('[RateMode] Rate trial', trial.id, 'score:', score);
		db.ratings
			.put({
				trialId: trial.id,
				type: 'rating',
				score: score as 1 | 2 | 3 | 4 | 5,
			})
			.catch((err: unknown) =>
				console.error('[RateMode] Rating save failed:', err)
			);
	}

	function handlePrev() {
		console.log('[RateMode] Previous trial');
		setTrialIdx(idx - 1);
	}

	function handleNext() {
		console.log('[RateMode] Next trial');
		setTrialIdx(idx + 1);
	}

	function handleSkip() {
		console.log('[RateMode] Skip trial', trial.id);
		setTrialIdx(idx + 1);
	}

	async function handleDone() {
		console.log('[RateMode] Done — all trials rated');
		await navigate({ to: '/evaluate' });
	}

	return (
		<div className="flex flex-col h-full overflow-hidden">
			{/* ── Header ── */}
			<div className="px-5 py-4 border-b border-border shrink-0">
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-2 min-w-0">
						{model && (
							<ModelBadge
								name={model.name}
								provider={model.provider}
							/>
						)}
						<span className="text-sm text-foreground truncate">
							{trial.input}
						</span>
					</div>
					<span className="text-xs text-muted-foreground shrink-0">
						Trial {idx + 1} of {total}
					</span>
				</div>
			</div>

			{/* ── Content ── */}
			<div className="flex-1 overflow-y-auto p-5 space-y-4">
				{/* Music renderer */}
				<MusicRenderer output={trial.output ?? ''} />

				{/* Raw output collapsible */}
				<div>
					<button
						type="button"
						onClick={() => {
							console.log(
								'[RateMode] Toggle raw output:',
								!rawExpanded
							);
							setRawExpanded((v) => !v);
						}}
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
						<pre className="mt-2 p-3 bg-muted rounded-md text-xs font-mono text-foreground overflow-auto max-h-64 whitespace-pre-wrap break-all">
							{trial.output ?? '(no output)'}
						</pre>
					)}
				</div>

				{/* Star rating */}
				<div>
					<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
						Rating
					</p>
					<StarRating value={currentRating} onChange={handleRate} />
				</div>
			</div>

			{/* ── Navigation footer ── */}
			<div className="px-5 py-4 border-t border-border shrink-0 flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handlePrev}
						disabled={idx === 0}
						className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-30 disabled:cursor-default transition-colors duration-150"
					>
						<ChevronLeft size={14} />
						Prev
					</button>

					{!currentRating && idx < total - 1 && (
						<button
							type="button"
							onClick={handleSkip}
							className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted transition-colors duration-150"
						>
							<SkipForward size={14} />
							Skip
						</button>
					)}
				</div>

				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">
						{ratedCount}/{total} rated
					</span>

					{allRated ? (
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
							onClick={handleNext}
							disabled={idx === total - 1}
							className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-30 disabled:cursor-default transition-colors duration-150"
						>
							Next
							<ChevronRight size={14} />
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
