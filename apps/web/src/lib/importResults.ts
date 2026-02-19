import { db } from '@/db';
import type { RunExportData } from './exportResults';

// ─── Re-export types ───────────────────────────────────────────────────────────

export type { RunExportData };

// ─── Parse result ─────────────────────────────────────────────────────────────

export type ParseResultsResult =
	| { ok: true; data: RunExportData }
	| { ok: false; errors: string[] };

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_STRATEGIES = new Set(['parse', 'rate', 'compare']);

export function parseResultsJson(text: string): ParseResultsResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text.trim());
	} catch (e) {
		return {
			ok: false,
			errors: [
				`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
			],
		};
	}

	if (
		typeof parsed !== 'object' ||
		parsed === null ||
		Array.isArray(parsed)
	) {
		return { ok: false, errors: ['Expected a JSON object'] };
	}

	const o = parsed as Record<string, unknown>;
	const errors: string[] = [];

	if (o.version !== 1) {
		errors.push('`version` must be 1');
	}

	if (typeof o.exportedAt !== 'string') {
		errors.push('`exportedAt` must be a string');
	}

	// Validate plan
	if (
		typeof o.plan !== 'object' ||
		o.plan === null ||
		Array.isArray(o.plan)
	) {
		errors.push('`plan` must be an object');
	} else {
		const plan = o.plan as Record<string, unknown>;
		if (typeof plan.name !== 'string' || plan.name.trim() === '') {
			errors.push('`plan.name` must be a non-empty string');
		}
		if (typeof plan.promptTemplate !== 'string') {
			errors.push('`plan.promptTemplate` must be a string');
		}
		if (!Array.isArray(plan.inputs)) {
			errors.push('`plan.inputs` must be an array');
		}
		if (!VALID_STRATEGIES.has(plan.evalStrategy as string)) {
			errors.push(
				'`plan.evalStrategy` must be "parse", "rate", or "compare"'
			);
		}
	}

	// Validate models array
	if (!Array.isArray(o.models)) {
		errors.push('`models` must be an array');
	}

	// Validate run
	if (typeof o.run !== 'object' || o.run === null || Array.isArray(o.run)) {
		errors.push('`run` must be an object');
	} else {
		const run = o.run as Record<string, unknown>;
		if (typeof run.startedAt !== 'string') {
			errors.push('`run.startedAt` must be a string');
		}
	}

	// Validate trials array
	if (!Array.isArray(o.trials)) {
		errors.push('`trials` must be an array');
	}

	// Check judgment arrays exist
	if (!Array.isArray(o.verdicts)) {
		errors.push('`verdicts` must be an array');
	}
	if (!Array.isArray(o.ratings)) {
		errors.push('`ratings` must be an array');
	}
	if (!Array.isArray(o.rankings)) {
		errors.push('`rankings` must be an array');
	}

	if (errors.length > 0) return { ok: false, errors };

	return { ok: true, data: parsed as RunExportData };
}

// ─── Import ───────────────────────────────────────────────────────────────────

/** Write exported run data into Dexie. Returns the new runId. */
export async function importRunResults(data: RunExportData): Promise<string> {
	console.log('[importResults] Importing run results, plan:', data.plan.name);

	const now = new Date();

	// ── 1. Models: look up by name, create if missing ────────────────────────
	const oldToNewModelId = new Map<string, string>();

	for (const exportedModel of data.models) {
		const existing = await db.models
			.filter((m) => m.name === exportedModel.name)
			.first();

		if (existing) {
			oldToNewModelId.set(exportedModel.id, existing.id);
		} else {
			const newId = crypto.randomUUID();
			await db.models.add({
				id: newId,
				name: exportedModel.name,
				provider: exportedModel.provider,
				apiBase: null,
				enabled: true,
			});
			oldToNewModelId.set(exportedModel.id, newId);
		}
	}

	// ── 2. Plan: always create a new plan (resolve/create folder) ────────────
	let folderId: string;
	const existingFolder = await db.folders
		.filter((f) => f.name === data.plan.folder)
		.first();

	if (existingFolder) {
		folderId = existingFolder.id;
	} else {
		folderId = crypto.randomUUID();
		await db.folders.add({
			id: folderId,
			name: data.plan.folder,
			parentId: null,
			createdAt: now,
		});
	}

	const planId = crypto.randomUUID();
	await db.plans.add({
		id: planId,
		folderId,
		name: data.plan.name,
		promptTemplate: data.plan.promptTemplate,
		inputs: data.plan.inputs,
		evalStrategy: data.plan.evalStrategy,
		parseCode: data.plan.parseCode,
		createdAt: now,
		updatedAt: now,
	});

	// ── 3. Run ────────────────────────────────────────────────────────────────
	const newRunId = crypto.randomUUID();
	const newModelIds = data.models
		.map((m) => oldToNewModelId.get(m.id))
		.filter((id): id is string => id !== undefined);

	await db.runs.add({
		id: newRunId,
		planId,
		modelIds: newModelIds,
		status: 'complete',
		startedAt: new Date(data.run.startedAt),
		completedAt: data.run.completedAt
			? new Date(data.run.completedAt)
			: null,
	});

	// ── 4. Trials: create with new UUIDs, build oldId → newId map ────────────
	const oldToNewTrialId = new Map<string, string>();

	for (const exportedTrial of data.trials) {
		const newTrialId = crypto.randomUUID();
		oldToNewTrialId.set(exportedTrial.id, newTrialId);

		const newModelId = oldToNewModelId.get(exportedTrial.modelId);
		if (!newModelId) {
			console.warn(
				'[importResults] No model mapping for trial modelId:',
				exportedTrial.modelId
			);
			continue;
		}

		await db.trials.add({
			id: newTrialId,
			runId: newRunId,
			modelId: newModelId,
			input: exportedTrial.input,
			inputIndex: exportedTrial.inputIndex,
			output: exportedTrial.output,
			latencyMs: exportedTrial.latencyMs,
			tokens: exportedTrial.tokens,
			status: exportedTrial.status,
		});
	}

	// ── 5. Judgments ──────────────────────────────────────────────────────────
	for (const v of data.verdicts) {
		const newTrialId = oldToNewTrialId.get(v.trialId);
		if (!newTrialId) continue;
		await db.verdicts.add({
			trialId: newTrialId,
			type: 'verdict',
			pass: v.pass,
			error: v.error,
		});
	}

	for (const r of data.ratings) {
		const newTrialId = oldToNewTrialId.get(r.trialId);
		if (!newTrialId) continue;
		await db.ratings.add({
			trialId: newTrialId,
			type: 'rating',
			score: r.score,
		});
	}

	for (const rk of data.rankings) {
		const newModelRanks = rk.modelRanks
			.map((mr) => {
				const newModelId = oldToNewModelId.get(mr.modelId);
				return newModelId
					? { modelId: newModelId, rank: mr.rank }
					: null;
			})
			.filter(
				(mr): mr is { modelId: string; rank: number } => mr !== null
			);

		await db.rankings.add({
			runId: newRunId,
			inputIndex: rk.inputIndex,
			type: 'ranking',
			modelRanks: newModelRanks,
		});
	}

	console.log('[importResults] Import complete, new runId:', newRunId);
	return newRunId;
}
