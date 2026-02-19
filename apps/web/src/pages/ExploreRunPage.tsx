import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download } from 'lucide-react';
import { db } from '@/db';
import { computeReport } from '@/lib/computeReport';
import { exportRunResults } from '@/lib/exportResults';
import Leaderboard from '@/components/explore/Leaderboard';
import TrialTable from '@/components/explore/TrialTable';
import type { Ranking, Rating, Verdict } from '@/types';

export default function ExploreRunPage() {
	const { runId } = useParams({ from: '/explore/$runId' });
	const [exporting, setExporting] = useState(false);
	console.log('[ExploreRunPage] runId:', runId);

	async function handleExport() {
		console.log('[ExploreRunPage] Exporting run results:', runId);
		setExporting(true);
		try {
			await exportRunResults(runId);
		} finally {
			setExporting(false);
		}
	}

	const data = useLiveQuery(async () => {
		const run = await db.runs.get(runId);
		if (!run) return null;

		const plan = await db.plans.get(run.planId);
		if (!plan) return null;

		const [trials, models] = await Promise.all([
			db.trials.where('runId').equals(runId).toArray(),
			db.models.where('id').anyOf(run.modelIds).toArray(),
		]);

		const modelMap = new Map(models.map((m) => [m.id, m]));

		// Load judgments based on eval strategy
		let verdicts: Verdict[] = [];
		let ratings: Rating[] = [];
		let rankings: Ranking[] = [];

		const trialIds = trials.map((t) => t.id);

		if (plan.evalStrategy === 'parse') {
			verdicts = await db.verdicts
				.where('trialId')
				.anyOf(trialIds)
				.toArray();
		} else if (plan.evalStrategy === 'rate') {
			ratings = await db.ratings
				.where('trialId')
				.anyOf(trialIds)
				.toArray();
		} else {
			rankings = await db.rankings.where('runId').equals(runId).toArray();
		}

		const judgments = [...verdicts, ...ratings, ...rankings];
		const report = computeReport(run, plan.evalStrategy, trials, judgments);

		const verdictMap = new Map(verdicts.map((v) => [v.trialId, v]));
		const ratingMap = new Map(ratings.map((r) => [r.trialId, r]));
		const rankingMap = new Map(rankings.map((r) => [r.inputIndex, r]));

		return {
			run,
			plan,
			trials,
			modelMap,
			verdictMap,
			ratingMap,
			rankingMap,
			report,
		};
	}, [runId]);

	if (data === undefined) {
		return (
			<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
				Loading…
			</div>
		);
	}

	if (data === null) {
		return (
			<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
				Run not found
			</div>
		);
	}

	const {
		plan,
		trials,
		modelMap,
		verdictMap,
		ratingMap,
		rankingMap,
		report,
	} = data;

	return (
		<div className="flex-1 overflow-hidden flex flex-col">
			{/* Leaderboard — upper section */}
			<div className="shrink-0 border-b border-border">
				<div className="flex justify-end px-5 pt-3 pb-0">
					<button
						type="button"
						onClick={handleExport}
						disabled={exporting}
						className="inline-flex items-center px-2.5 py-1 text-xs rounded-md border border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-default transition-colors duration-150"
					>
						<Download className="w-3.5 h-3.5 mr-1.5" />
						{exporting ? 'Exporting…' : 'Export Results'}
					</button>
				</div>
				<Leaderboard
					runId={runId}
					evalStrategy={plan.evalStrategy}
					modelScores={report.modelScores}
					modelMap={modelMap}
				/>
			</div>

			{/* Trial detail table — lower section */}
			<div className="flex-1 overflow-hidden flex flex-col">
				<TrialTable
					evalStrategy={plan.evalStrategy}
					trials={trials}
					modelMap={modelMap}
					verdictMap={verdictMap}
					ratingMap={ratingMap}
					rankingMap={rankingMap}
				/>
			</div>
		</div>
	);
}
