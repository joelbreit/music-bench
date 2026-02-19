import Dexie, { type Table } from 'dexie';
import type {
	Folder,
	Plan,
	Model,
	Run,
	Trial,
	Verdict,
	Rating,
	Ranking,
	TrialNote,
} from '@/types';

class MusicBenchDB extends Dexie {
	folders!: Table<Folder>;
	plans!: Table<Plan>;
	models!: Table<Model>;
	runs!: Table<Run>;
	trials!: Table<Trial>;
	verdicts!: Table<Verdict>;
	ratings!: Table<Rating>;
	rankings!: Table<Ranking>;
	trialNotes!: Table<TrialNote>;

	constructor() {
		super('music-bench');
		this.version(1).stores({
			folders: 'id, parentId, createdAt',
			plans: 'id, folderId, createdAt',
			models: 'id',
			runs: 'id, planId, status, startedAt',
			trials: 'id, runId, modelId, status',
			verdicts: 'trialId',
			ratings: 'trialId',
			rankings: '[runId+inputIndex]',
		});
		this.version(2).stores({
			trialNotes: 'trialId',
		});
	}
}

export const db = new MusicBenchDB();

// ─── Seed ─────────────────────────────────────────────────────────────────────

export async function seedIfEmpty(): Promise<void> {
	const folderCount = await db.folders.count();
	if (folderCount > 0) {
		console.log('[db] Already seeded, skipping.');
		return;
	}

	console.log('[db] Seeding database with fixture data...');
	const now = new Date();

	// Folders
	await db.folders.bulkAdd([
		{
			id: 'folder-abc',
			name: 'ABC Notation Tests',
			parentId: null,
			createdAt: now,
		},
		{
			id: 'folder-harmony',
			name: 'Harmony Studies',
			parentId: null,
			createdAt: now,
		},
	]);

	// Plans
	await db.plans.bulkAdd([
		{
			id: 'plan-melody',
			folderId: 'folder-abc',
			name: 'Simple Melody Generation',
			promptTemplate:
				'Generate a short 8-bar melody in ABC notation for the following theme: {{input}}',
			inputs: [
				"a happy children's song",
				'a sad ballad',
				'an upbeat march',
			],
			evalStrategy: 'parse',
			parseCode:
				'// Returns true if output contains a valid ABC notation header\nfunction assert(output) {\n\treturn /^X:\\d/m.test(output) && /^T:/m.test(output);\n}',
			createdAt: now,
			updatedAt: now,
		},
		{
			id: 'plan-chord',
			folderId: 'folder-abc',
			name: 'Chord Progression',
			promptTemplate:
				'Write a 4-bar chord progression in ABC notation for: {{input}}',
			inputs: ['C major blues', 'ii-V-I in G major'],
			evalStrategy: 'rate',
			parseCode: null,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: 'plan-harmony',
			folderId: 'folder-harmony',
			name: 'Melody Harmonization',
			promptTemplate:
				'Harmonize the following melody and output ABC notation: {{input}}',
			inputs: [
				'a descending scale in D minor',
				'a rising arpeggio in E major',
			],
			evalStrategy: 'compare',
			parseCode: null,
			createdAt: now,
			updatedAt: now,
		},
	]);

	// Models — use OpenRouter model IDs (provider/model-id format)
	await db.models.bulkAdd([
		{
			id: 'model-claude-opus',
			name: 'anthropic/claude-opus-4-6',
			provider: 'anthropic',
			apiBase: null,
			enabled: true,
		},
		{
			id: 'model-claude-sonnet',
			name: 'anthropic/claude-sonnet-4-6',
			provider: 'anthropic',
			apiBase: null,
			enabled: true,
		},
		{
			id: 'model-gpt4o',
			name: 'openai/gpt-4o',
			provider: 'openai',
			apiBase: null,
			enabled: true,
		},
		{
			id: 'model-gpt4o-mini',
			name: 'openai/gpt-4o-mini',
			provider: 'openai',
			apiBase: null,
			enabled: false,
		},
	]);

	// Completed Parse run (has verdicts — ready to Explore)
	const run1StartedAt = new Date(now.getTime() - 3_600_000);
	const run1CompletedAt = new Date(run1StartedAt.getTime() + 120_000);

	await db.runs.add({
		id: 'run-parse-1',
		planId: 'plan-melody',
		modelIds: ['model-claude-opus', 'model-claude-sonnet'],
		status: 'complete',
		startedAt: run1StartedAt,
		completedAt: run1CompletedAt,
	});

	const parseInputs = [
		"a happy children's song",
		'a sad ballad',
		'an upbeat march',
	];
	const sampleOutput = `X:1\nT:Generated Melody\nM:4/4\nL:1/8\nK:C\n|: CDEF GABC' :|`;

	const parseTrials: Trial[] = [];
	const parseVerdicts: Verdict[] = [];

	for (const [mi, modelId] of [
		'model-claude-opus',
		'model-claude-sonnet',
	].entries()) {
		for (const [ii, input] of parseInputs.entries()) {
			const trialId = `trial-parse1-${mi}-${ii}`;
			const pass = mi === 0 || ii < 2; // opus passes all; sonnet fails last
			parseTrials.push({
				id: trialId,
				runId: 'run-parse-1',
				modelId,
				input,
				inputIndex: ii,
				output: pass
					? sampleOutput
					: 'Sorry, I cannot generate ABC notation for this input.',
				latencyMs: 800 + Math.floor(Math.random() * 1200),
				tokens: 150 + Math.floor(Math.random() * 200),
				status: 'complete',
			});
			parseVerdicts.push({
				trialId,
				type: 'verdict',
				pass,
				error: pass ? null : 'ABC header not found in output',
			});
		}
	}

	await db.trials.bulkAdd(parseTrials);
	await db.verdicts.bulkAdd(parseVerdicts);

	// Completed Rate run (no judgments — pending evaluation)
	const run2StartedAt = new Date(now.getTime() - 1_800_000);
	const run2CompletedAt = new Date(run2StartedAt.getTime() + 60_000);

	await db.runs.add({
		id: 'run-rate-1',
		planId: 'plan-chord',
		modelIds: ['model-claude-opus', 'model-gpt4o'],
		status: 'complete',
		startedAt: run2StartedAt,
		completedAt: run2CompletedAt,
	});

	const rateInputs = ['C major blues', 'ii-V-I in G major'];
	const rateTrials: Trial[] = [];

	for (const [mi, modelId] of [
		'model-claude-opus',
		'model-gpt4o',
	].entries()) {
		for (const [ii, input] of rateInputs.entries()) {
			rateTrials.push({
				id: `trial-rate1-${mi}-${ii}`,
				runId: 'run-rate-1',
				modelId,
				input,
				inputIndex: ii,
				output: `X:1\nT:Chord Progression\nM:4/4\nL:1/4\nK:C\n|: C E G c :|`,
				latencyMs: 600 + Math.floor(Math.random() * 800),
				tokens: 100 + Math.floor(Math.random() * 150),
				status: 'complete',
			});
		}
	}

	await db.trials.bulkAdd(rateTrials);
	console.log('[db] Seeding complete.');
}
