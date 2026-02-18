// T12 — Run Execution Engine
//
// Drives a single Run from 'queued' to 'complete' (or 'cancelled'/'failed').
// Trials run sequentially, one at a time, in model × input order.
//
// isCancelled() is polled before each trial; returning true stops execution
// and marks the run as 'cancelled'.

import { db } from '@/db';
import { getAdapter } from '@/lib/adapters';
import { runParseAssertion } from '@/lib/parseVerdict';
import type { Trial } from '@/types';

export async function executeRun(
	runId: string,
	onProgress: (completed: number, total: number) => void,
	isCancelled: () => boolean
): Promise<void> {
	console.log('[runExecutor] Starting run', runId);

	const run = await db.runs.get(runId);
	if (!run || run.status !== 'queued') {
		console.warn('[runExecutor] Run not found or not queued:', runId);
		return;
	}

	const plan = await db.plans.get(run.planId);
	if (!plan) {
		console.error('[runExecutor] Plan not found:', run.planId);
		await db.runs.update(runId, {
			status: 'failed',
			completedAt: new Date(),
		});
		return;
	}

	// Preserve the model order from run.modelIds
	const allModels = await db.models.where('id').anyOf(run.modelIds).toArray();
	const modelMap = new Map(allModels.map((m) => [m.id, m]));
	const models = run.modelIds
		.map((id) => modelMap.get(id))
		.filter((m): m is NonNullable<typeof m> => m !== undefined);

	await db.runs.update(runId, { status: 'running' });

	// Create one trial per model × input
	const trialDefs: Trial[] = [];
	for (const model of models) {
		for (let i = 0; i < plan.inputs.length; i++) {
			trialDefs.push({
				id: crypto.randomUUID(),
				runId,
				modelId: model.id,
				input: plan.inputs[i],
				inputIndex: i,
				output: null,
				latencyMs: null,
				tokens: null,
				status: 'pending',
			});
		}
	}
	await db.trials.bulkAdd(trialDefs);
	console.log(
		'[runExecutor] Created',
		trialDefs.length,
		'trials for run',
		runId
	);

	const total = trialDefs.length;
	let completed = 0;
	onProgress(0, total);

	for (const trial of trialDefs) {
		if (isCancelled()) {
			console.log(
				'[runExecutor] Cancellation requested — stopping run',
				runId
			);
			await db.runs.update(runId, {
				status: 'cancelled',
				completedAt: new Date(),
			});
			return;
		}

		const model = modelMap.get(trial.modelId)!;
		await db.trials.update(trial.id, { status: 'running' });
		console.log(
			'[runExecutor] Trial',
			trial.id,
			'— model:',
			model.name,
			'input:',
			trial.input
		);

		try {
			const prompt = plan.promptTemplate.replace(
				/\{\{input\}\}/g,
				trial.input
			);
			const adapter = getAdapter(model);
			const result = await adapter.call(model, prompt, trial.input);

			await db.trials.update(trial.id, {
				output: result.output,
				latencyMs: result.latencyMs,
				tokens: result.tokens,
				status: 'complete',
			});
			console.log(
				'[runExecutor] Trial complete',
				trial.id,
				'latency:',
				result.latencyMs + 'ms',
				'tokens:',
				result.tokens
			);

			// T13: run parse assertion inline for Parse-strategy plans
			if (plan.evalStrategy === 'parse' && plan.parseCode) {
				const verdict = runParseAssertion(
					trial.id,
					plan.parseCode,
					result.output
				);
				await db.verdicts.add(verdict);
				console.log(
					'[runExecutor] Verdict for',
					trial.id,
					'— pass:',
					verdict.pass,
					verdict.error ? '| error: ' + verdict.error : ''
				);
			}
		} catch (err) {
			console.error('[runExecutor] Trial failed', trial.id, err);
			await db.trials.update(trial.id, { status: 'failed' });
		}

		completed++;
		onProgress(completed, total);
	}

	await db.runs.update(runId, {
		status: 'complete',
		completedAt: new Date(),
	});
	console.log('[runExecutor] Run complete', runId);
}
