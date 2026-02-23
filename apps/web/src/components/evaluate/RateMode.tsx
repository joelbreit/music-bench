import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from '@tanstack/react-router';
import {
	Check,
	ChevronLeft,
	ChevronRight,
	Copy,
	Eye,
	SkipForward,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/db';
import MusicRenderer from '@/components/music/MusicRenderer';
import type { Plan, Provider, Run, Trial } from '@/types';

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

// ─── Seeded Fisher-Yates shuffle ──────────────────────────────────────────────
// Deterministic: same seed → same order. Used so Prev/Next are stable across
// re-renders triggered by useLiveQuery (e.g. when a rating is saved).

function seededShuffle<T>(arr: T[], seed: number): T[] {
	const result = [...arr];
	// LCG generator seeded from a float in [0, 1)
	let s = Math.floor(seed * 2147483647);
	for (let i = result.length - 1; i > 0; i--) {
		s = (Math.imul(s, 1664525) + 1013904223) | 0;
		const j = (s >>> 1) % (i + 1);
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

// ─── Trial notes ─────────────────────────────────────────────────────────────

function TrialNotes({
	initialNotes,
	onSave,
}: {
	initialNotes: string;
	onSave: (notes: string) => void;
}) {
	const [notes, setNotes] = useState(initialNotes);
	const [isDirty, setIsDirty] = useState(false);
	const onSaveRef = useRef(onSave);
	useLayoutEffect(() => {
		onSaveRef.current = onSave;
	});

	useEffect(() => {
		if (!isDirty) return;
		const timer = setTimeout(() => {
			console.log('[TrialNotes] Auto-saving notes');
			onSaveRef.current(notes);
			setIsDirty(false);
		}, 1000);
		return () => clearTimeout(timer);
	}, [isDirty, notes]);

	return (
		<textarea
			value={notes}
			onChange={(e) => {
				setNotes(e.target.value);
				setIsDirty(true);
			}}
			placeholder="Add notes…"
			className="w-full min-h-[80px] px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
		/>
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
	const [copiedAbc, setCopiedAbc] = useState(false);

	// Stable random seed — fixed at mount, survives re-renders from useLiveQuery.
	// Component is keyed by runId, so a new run gets a fresh shuffle.
	const [seed] = useState(Math.random);

	// Per-trial reveal — shows model name briefly then auto-hides.
	const [revealedTrialId, setRevealedTrialId] = useState<string | null>(null);
	const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
		};
	}, []);

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

		const trialNoteRows = await db.trialNotes
			.where('trialId')
			.anyOf(sorted.map((t) => t.id))
			.toArray();
		const notesMap = new Map(
			trialNoteRows.map((n) => [n.trialId, n.notes])
		);

		return { sorted, modelMap, ratingMap, notesMap };
	}, [run.id]);

	if (!data) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
				Loading…
			</div>
		);
	}

	// Apply stable shuffle — deterministic for this seed so result is consistent
	// across re-renders from useLiveQuery (ratings save triggers re-run).
	const trials: Trial[] = seededShuffle([...data.sorted], seed);
	const { modelMap, ratingMap, notesMap } = data;

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
	const rawOutput = trial.output ?? '';
	const abcMatch =
		/```abc\n([\s\S]*?)```/.exec(rawOutput) ??
		/```\n([\s\S]*?)```/.exec(rawOutput);
	const abcContent = abcMatch ? abcMatch[1] : null;

	function handleCopyAbc() {
		if (!abcContent) return;
		console.log('[RateMode] Copying ABC content for trial:', trial.id);
		void navigator.clipboard.writeText(abcContent).then(() => {
			setCopiedAbc(true);
			setTimeout(() => setCopiedAbc(false), 1500);
		});
	}
	const currentRating = ratingMap.get(trial.id) ?? null;
	const currentNotes = notesMap.get(trial.id) ?? '';

	function handleSaveNotes(notes: string) {
		console.log('[RateMode] Saving notes for trial:', trial.id);
		db.trialNotes
			.put({ trialId: trial.id, notes })
			.catch((err: unknown) =>
				console.error('[RateMode] Notes save failed:', err)
			);
	}
	const total = trials.length;
	const ratedCount = ratingMap.size;
	const allRated = ratedCount === total;
	const isRevealed = revealedTrialId === trial.id;

	function handleReveal() {
		console.log('[RateMode] Revealing model for trial:', trial.id);
		if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
		setRevealedTrialId(trial.id);
		revealTimerRef.current = setTimeout(() => {
			setRevealedTrialId(null);
		}, 2500);
	}

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
						{/* Model name — hidden until revealed */}
						{isRevealed && model ? (
							<ModelBadge
								name={model.name}
								provider={model.provider}
							/>
						) : (
							<button
								type="button"
								onClick={handleReveal}
								className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/60 text-[10px] text-muted-foreground hover:text-foreground hover:border-border transition-colors duration-150 shrink-0"
							>
								<Eye size={10} />
								Reveal
							</button>
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
					<div className="flex items-center gap-3">
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
						{abcContent !== null && (
							<button
								type="button"
								onClick={handleCopyAbc}
								title="Copy ABC notation"
								className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
							>
								{copiedAbc ? (
									<Check size={11} className="text-success" />
								) : (
									<Copy size={11} />
								)}
								{copiedAbc ? 'Copied' : 'Copy ABC'}
							</button>
						)}
					</div>
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

				{/* Notes */}
				<div>
					<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
						Notes
					</p>
					<TrialNotes
						key={trial.id}
						initialNotes={currentNotes}
						onSave={handleSaveNotes}
					/>
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
