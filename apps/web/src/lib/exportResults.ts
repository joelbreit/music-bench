import { db } from '@/db';
import type { Provider, TrialStatus } from '@/types';

// ─── Wire format ──────────────────────────────────────────────────────────────

export interface RunExportData {
	version: 1;
	exportedAt: string;
	plan: {
		name: string;
		folder: string;
		promptTemplate: string;
		inputs: string[];
		evalStrategy: 'parse' | 'rate' | 'compare';
		parseCode: string | null;
	};
	models: {
		id: string;
		name: string;
		provider: Provider;
	}[];
	run: {
		startedAt: string;
		completedAt: string | null;
	};
	trials: {
		id: string;
		modelId: string;
		input: string;
		inputIndex: number;
		output: string | null;
		latencyMs: number | null;
		tokens: number | null;
		status: TrialStatus;
	}[];
	verdicts: { trialId: string; pass: boolean; error: string | null }[];
	ratings: { trialId: string; score: 1 | 2 | 3 | 4 | 5 }[];
	rankings: {
		inputIndex: number;
		modelRanks: { modelId: string; rank: number }[];
	}[];
}

// ─── Download helper ──────────────────────────────────────────────────────────

function triggerDownload(filename: string, data: unknown): void {
	const json = JSON.stringify(data, null, 2);
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

function toSlug(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'run'
	);
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function buildRunExportData(runId: string): Promise<RunExportData> {
	const run = await db.runs.get(runId);
	if (!run) throw new Error(`Run not found: ${runId}`);

	const plan = await db.plans.get(run.planId);
	if (!plan) throw new Error(`Plan not found: ${run.planId}`);

	const folder = await db.folders.get(plan.folderId);
	const folderName = folder?.name ?? 'Imported';

	const models = await db.models.where('id').anyOf(run.modelIds).toArray();
	const trials = await db.trials.where('runId').equals(runId).toArray();
	const trialIds = trials.map((t) => t.id);

	let verdicts: RunExportData['verdicts'] = [];
	let ratings: RunExportData['ratings'] = [];
	let rankings: RunExportData['rankings'] = [];

	if (plan.evalStrategy === 'parse') {
		const raw = await db.verdicts
			.where('trialId')
			.anyOf(trialIds)
			.toArray();
		verdicts = raw.map((v) => ({
			trialId: v.trialId,
			pass: v.pass,
			error: v.error,
		}));
	} else if (plan.evalStrategy === 'rate') {
		const raw = await db.ratings.where('trialId').anyOf(trialIds).toArray();
		ratings = raw.map((r) => ({ trialId: r.trialId, score: r.score }));
	} else {
		const raw = await db.rankings.where('runId').equals(runId).toArray();
		rankings = raw.map((r) => ({
			inputIndex: r.inputIndex,
			modelRanks: r.modelRanks,
		}));
	}

	return {
		version: 1,
		exportedAt: new Date().toISOString(),
		plan: {
			name: plan.name,
			folder: folderName,
			promptTemplate: plan.promptTemplate,
			inputs: plan.inputs,
			evalStrategy: plan.evalStrategy,
			parseCode: plan.parseCode,
		},
		models: models.map((m) => ({
			id: m.id,
			name: m.name,
			provider: m.provider,
		})),
		run: {
			startedAt: run.startedAt.toISOString(),
			completedAt: run.completedAt ? run.completedAt.toISOString() : null,
		},
		trials: trials.map((t) => ({
			id: t.id,
			modelId: t.modelId,
			input: t.input,
			inputIndex: t.inputIndex,
			output: t.output,
			latencyMs: t.latencyMs,
			tokens: t.tokens,
			status: t.status,
		})),
		verdicts,
		ratings,
		rankings,
	};
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Download a single run as `<plan-slug>-results.musicbench-results.json`. */
export async function exportRunResults(runId: string): Promise<void> {
	console.log('[exportResults] Exporting run results:', runId);
	const data = await buildRunExportData(runId);
	const slug = toSlug(data.plan.name);
	triggerDownload(`${slug}-results.musicbench-results.json`, data);
	console.log('[exportResults] Download triggered for run:', runId);
}

/** Download all given runs as a single `all-results.musicbench-results.json` array. */
export async function exportAllRunResults(runIds: string[]): Promise<void> {
	console.log('[exportResults] Exporting all run results:', runIds.length);
	const all = await Promise.all(runIds.map((id) => buildRunExportData(id)));
	triggerDownload('all-results.musicbench-results.json', all);
	console.log('[exportResults] Download triggered for', all.length, 'runs');
}
