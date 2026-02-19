import { db } from '@/db';
import type {
	AggregateModelRow,
	AggregateReport,
	Judgment,
	PlanScore,
	PlanSummary,
	Run,
} from '@/types';
import { computeReport } from './computeReport';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch all judgments for a run, or an empty array if there are none. */
async function fetchJudgments(
	run: Run,
	trialIds: string[]
): Promise<Judgment[]> {
	const [verdicts, ratings, rankings] = await Promise.all([
		trialIds.length > 0
			? db.verdicts.where('trialId').anyOf(trialIds).toArray()
			: Promise.resolve([]),
		trialIds.length > 0
			? db.ratings.where('trialId').anyOf(trialIds).toArray()
			: Promise.resolve([]),
		db.rankings.filter((r) => r.runId === run.id).toArray(),
	]);
	return [...verdicts, ...ratings, ...rankings];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute an AggregateReport for a set of plans.
 *
 * For each (model, plan) pair the score comes from the most recent complete run
 * that (a) included the model and (b) has at least one judgment. When no such
 * run exists the score is null. The overall score per model is the unweighted
 * mean of all non-null plan scores.
 *
 * @param planIds  IDs of the plans to include. Order is preserved in planSummaries.
 */
export async function computeAggregateReport(
	planIds: string[]
): Promise<AggregateReport> {
	console.log(
		'[computeAggregateReport] Computing aggregate for plans:',
		planIds
	);

	if (planIds.length === 0) {
		return { modelRows: [], planSummaries: [] };
	}

	// Load plans and models in parallel
	const [plans, models] = await Promise.all([
		db.plans.where('id').anyOf(planIds).toArray(),
		db.models.toArray(),
	]);

	const planMap = new Map(plans.map((p) => [p.id, p]));
	const modelMap = new Map(models.map((m) => [m.id, m]));

	// For each plan, load complete runs sorted newest-first, then filter to those
	// with ≥1 judgment and compute their reports.
	const scoredRunsByPlan = new Map<string, Run[]>();
	const reportByRunId = new Map<string, ReturnType<typeof computeReport>>();

	for (const planId of planIds) {
		const plan = planMap.get(planId);
		if (!plan) {
			scoredRunsByPlan.set(planId, []);
			continue;
		}

		const runs = await db.runs
			.where('planId')
			.equals(planId)
			.filter((r) => r.status === 'complete')
			.toArray();

		// Newest first so the first matching run for a model is always the latest
		runs.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

		const scored: Run[] = [];
		for (const run of runs) {
			const trials = await db.trials
				.where('runId')
				.equals(run.id)
				.toArray();
			const trialIds = trials.map((t) => t.id);
			const judgments = await fetchJudgments(run, trialIds);

			if (judgments.length === 0) continue;

			const report = computeReport(
				run,
				plan.evalStrategy,
				trials,
				judgments
			);
			reportByRunId.set(run.id, report);
			scored.push(run);
		}
		scoredRunsByPlan.set(planId, scored);
	}

	// Collect all model IDs that appear in at least one scored run
	const allModelIds = new Set<string>();
	for (const runs of scoredRunsByPlan.values()) {
		for (const run of runs) {
			for (const modelId of run.modelIds) {
				allModelIds.add(modelId);
			}
		}
	}

	// Build planSummaries in the requested planIds order
	const planSummaries: PlanSummary[] = planIds
		.filter((pid) => planMap.has(pid))
		.map((planId) => {
			const plan = planMap.get(planId)!;
			const scored = scoredRunsByPlan.get(planId) ?? [];
			return {
				planId,
				planName: plan.name,
				evalStrategy: plan.evalStrategy,
				runCount: scored.length,
			};
		});

	// Build one row per model
	const modelRows: AggregateModelRow[] = Array.from(allModelIds).map(
		(modelId) => {
			const model = modelMap.get(modelId);

			const planScores: PlanScore[] = planSummaries.map(
				({ planId, planName }) => {
					const scoredRuns = scoredRunsByPlan.get(planId) ?? [];
					// Most recent scored run that included this model
					const run = scoredRuns.find((r) =>
						r.modelIds.includes(modelId)
					);
					if (!run) {
						return {
							planId,
							planName,
							score: null,
							runCount: scoredRuns.length,
							runId: null,
						};
					}
					const report = reportByRunId.get(run.id);
					const ms = report?.modelScores.find(
						(s) => s.modelId === modelId
					);
					return {
						planId,
						planName,
						score: ms?.score ?? null,
						runCount: scoredRuns.length,
						runId: run.id,
					};
				}
			);

			const nonNull = planScores
				.map((ps) => ps.score)
				.filter((s): s is number => s !== null);
			const overallScore =
				nonNull.length > 0
					? nonNull.reduce((sum, s) => sum + s, 0) / nonNull.length
					: null;

			return {
				modelId,
				modelName: model?.name ?? modelId,
				provider: model?.provider ?? 'other',
				overallScore,
				planScores,
			};
		}
	);

	// Sort by overallScore descending; nulls last
	modelRows.sort((a, b) => {
		if (a.overallScore === null && b.overallScore === null) return 0;
		if (a.overallScore === null) return 1;
		if (b.overallScore === null) return -1;
		return b.overallScore - a.overallScore;
	});

	console.log(
		'[computeAggregateReport] Done. Models:',
		modelRows.length,
		'Plans:',
		planSummaries.length
	);

	return { modelRows, planSummaries };
}
