// Run Execution Engine
//
// Drives a single Run from 'queued' to 'complete' (or 'cancelled'/'failed').
// Trials run in parallel: CONCURRENCY workers pull from a shared queue,
// each executing one trial at a time.
//
// Resume support: if trials already exist for the run (e.g. after a
// cancellation), completed trials are skipped and execution picks up from
// where it left off. Any trials stuck in 'running' are reset to 'pending'
// before resuming.
//
// isCancelled() is polled before each trial is picked up. In-flight trials
// always run to completion; cancellation only prevents new ones from starting.

import { db } from '@/db';
import { getAdapter } from '@/lib/adapters';
import { runParseAssertion } from '@/lib/parseVerdict';
import type { Trial } from '@/types';

const CONCURRENCY = 5;

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

	// ── Trial setup: fresh or resume ──────────────────────────────────────────
	const existingTrials = await db.trials
		.where('runId')
		.equals(runId)
		.toArray();

	let trialsToExecute: Trial[];
	let total: number;
	let completed: number;

	if (existingTrials.length > 0) {
		// Resume: reset any 'running' trials (interrupted mid-execution) to 'pending'
		const interrupted = existingTrials.filter(
			(t) => t.status === 'running'
		);
		if (interrupted.length > 0) {
			await Promise.all(
				interrupted.map((t) =>
					db.trials.update(t.id, { status: 'pending' })
				)
			);
		}
		total = existingTrials.length;
		completed = existingTrials.filter(
			(t) => t.status === 'complete'
		).length;
		trialsToExecute = existingTrials
			.filter((t) => t.status !== 'complete')
			.map((t) => ({ ...t, status: 'pending' as const }));
		console.log(
			'[runExecutor] Resuming run',
			runId,
			'— skipping',
			completed,
			'complete trials, executing',
			trialsToExecute.length
		);
	} else {
		// Fresh run: create one trial per model × input
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
		total = trialDefs.length;
		completed = 0;
		trialsToExecute = trialDefs;
	}

	onProgress(completed, total);

	// ── Parallel execution ─────────────────────────────────────────────────────
	// Workers pull from the queue until it's empty or cancellation is requested.
	// JS's single-threaded event loop makes queue.shift() safe across workers.

	const queue = [...trialsToExecute];

	async function executeOneTrial(trial: Trial): Promise<void> {
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

		const trialStart = Date.now();
		try {
			const prompt = plan.promptTemplate.replace(
				/\{\{input\}\}/g,
				trial.input
			);
			const adapter = getAdapter(model);
			const result = await adapter.call(model, prompt, trial.input);
			const trialLatencyMs = Date.now() - trialStart;

			await db.trials.update(trial.id, {
				output: result.output,
				latencyMs: trialLatencyMs,
				tokens: result.tokens,
				status: 'complete',
			});
			console.log(
				'[runExecutor] Trial complete',
				trial.id,
				'wall-clock:',
				trialLatencyMs + 'ms',
				'tokens:',
				result.tokens
			);

			// Run parse assertion inline for Parse-strategy plans
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
	}

	async function runWorker(): Promise<void> {
		while (queue.length > 0) {
			if (isCancelled()) return;
			const trial = queue.shift();
			if (!trial) return;
			await executeOneTrial(trial);
			completed++;
			onProgress(completed, total);
		}
	}

	const workerCount = Math.min(CONCURRENCY, trialsToExecute.length);
	console.log(
		'[runExecutor] Running',
		trialsToExecute.length,
		'trials with concurrency',
		workerCount
	);
	await Promise.all(Array.from({ length: workerCount }, runWorker));

	// ── Final status ───────────────────────────────────────────────────────────
	if (isCancelled()) {
		console.log('[runExecutor] Run cancelled', runId);
		await db.runs.update(runId, {
			status: 'cancelled',
			completedAt: new Date(),
		});
	} else {
		console.log('[runExecutor] Run complete', runId);
		await db.runs.update(runId, {
			status: 'complete',
			completedAt: new Date(),
		});
	}
}
