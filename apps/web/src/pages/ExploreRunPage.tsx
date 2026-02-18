import { useParams } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { computeReport } from '@/lib/computeReport';
import Leaderboard from '@/components/explore/Leaderboard';
import TrialTable from '@/components/explore/TrialTable';
import type { Ranking, Rating, Verdict } from '@/types';

export default function ExploreRunPage() {
	const { runId } = useParams({ from: '/explore/$runId' });
	console.log('[ExploreRunPage] runId:', runId);

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
