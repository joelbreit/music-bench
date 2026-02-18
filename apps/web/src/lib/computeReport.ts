import type {
	EvalStrategy,
	Judgment,
	ModelScore,
	Ranking,
	Rating,
	Report,
	Run,
	Trial,
	Verdict,
} from '@/types';

// ─── Strategy helpers ──────────────────────────────────────────────────────────

function computeParseScores(
	modelIds: string[],
	trials: Trial[],
	verdicts: Verdict[]
): ModelScore[] {
	const verdictMap = new Map(verdicts.map((v) => [v.trialId, v]));

	return modelIds.map((modelId) => {
		const modelTrials = trials.filter((t) => t.modelId === modelId);
		const trialCount = modelTrials.length;
		if (trialCount === 0) return { modelId, score: null, trialCount: 0 };

		const judged = modelTrials.filter((t) => verdictMap.has(t.id));
		if (judged.length === 0) return { modelId, score: null, trialCount };

		const passCount = judged.filter(
			(t) => verdictMap.get(t.id)!.pass
		).length;
		return { modelId, score: passCount / judged.length, trialCount };
	});
}

function computeRateScores(
	modelIds: string[],
	trials: Trial[],
	ratings: Rating[]
): ModelScore[] {
	const ratingMap = new Map(ratings.map((r) => [r.trialId, r]));

	return modelIds.map((modelId) => {
		const modelTrials = trials.filter((t) => t.modelId === modelId);
		const trialCount = modelTrials.length;
		if (trialCount === 0) return { modelId, score: null, trialCount: 0 };

		const judged = modelTrials
			.map((t) => ratingMap.get(t.id))
			.filter((r): r is Rating => r !== undefined);
		if (judged.length === 0) return { modelId, score: null, trialCount };

		const mean =
			judged.reduce((sum, r) => sum + r.score, 0) / judged.length;
		return { modelId, score: mean / 5, trialCount };
	});
}

function computeCompareScores(
	modelIds: string[],
	trials: Trial[],
	rankings: Ranking[]
): ModelScore[] {
	const modelCount = modelIds.length;

	// Single model — by convention scores 1.0
	if (modelCount <= 1) {
		const trialCount = trials.filter(
			(t) => modelIds[0] && t.modelId === modelIds[0]
		).length;
		return [{ modelId: modelIds[0] ?? '', score: 1, trialCount }];
	}

	// Collect rank entries across inputs for each model
	const ranksByModel = new Map<string, number[]>(
		modelIds.map((id) => [id, []])
	);
	for (const ranking of rankings) {
		for (const { modelId, rank } of ranking.modelRanks) {
			ranksByModel.get(modelId)?.push(rank);
		}
	}

	return modelIds.map((modelId) => {
		const modelTrials = trials.filter((t) => t.modelId === modelId);
		const trialCount = modelTrials.length;
		const ranks = ranksByModel.get(modelId) ?? [];
		if (ranks.length === 0) return { modelId, score: null, trialCount };

		const meanRank = ranks.reduce((sum, r) => sum + r, 0) / ranks.length;
		// Rank 1 (best) → score 1.0; rank modelCount (worst) → score 0.0
		const score = 1 - (meanRank - 1) / (modelCount - 1);
		return { modelId, score, trialCount };
	});
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute a Report from a completed Run's trials and judgments.
 *
 * @param run           The Run record (for runId and modelIds)
 * @param evalStrategy  The plan's eval strategy (Plan.evalStrategy)
 * @param trials        All trials belonging to the run
 * @param judgments     All judgments belonging to the run
 */
export function computeReport(
	run: Run,
	evalStrategy: EvalStrategy,
	trials: Trial[],
	judgments: Judgment[]
): Report {
	const verdicts = judgments.filter(
		(j): j is Verdict => j.type === 'verdict'
	);
	const ratings = judgments.filter((j): j is Rating => j.type === 'rating');
	const rankings = judgments.filter(
		(j): j is Ranking => j.type === 'ranking'
	);

	let modelScores: ModelScore[];
	if (evalStrategy === 'parse') {
		modelScores = computeParseScores(run.modelIds, trials, verdicts);
	} else if (evalStrategy === 'rate') {
		modelScores = computeRateScores(run.modelIds, trials, ratings);
	} else {
		modelScores = computeCompareScores(run.modelIds, trials, rankings);
	}

	return { runId: run.id, evalStrategy, modelScores };
}
