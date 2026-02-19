// ─── Folder & Plan ────────────────────────────────────────────────────────────

export interface Folder {
	id: string;
	name: string;
	parentId: string | null;
	createdAt: Date;
}

export type EvalStrategy = 'parse' | 'rate' | 'compare';

export interface Plan {
	id: string;
	folderId: string;
	name: string;
	promptTemplate: string;
	inputs: string[];
	evalStrategy: EvalStrategy;
	parseCode: string | null;
	createdAt: Date;
	updatedAt: Date;
}

// ─── Model ────────────────────────────────────────────────────────────────────

export type Provider =
	| 'anthropic'
	| 'openai'
	| 'google'
	| 'xai'
	| 'deepseek'
	| 'moonshot'
	| 'other';

export interface Model {
	id: string;
	name: string;
	provider: Provider;
	apiBase: string | null;
	enabled: boolean;
}

// ─── Run & Trial ──────────────────────────────────────────────────────────────

export type RunStatus =
	| 'queued'
	| 'running'
	| 'complete'
	| 'failed'
	| 'cancelled';

export interface Run {
	id: string;
	planId: string;
	modelIds: string[];
	status: RunStatus;
	startedAt: Date;
	completedAt: Date | null;
}

export type TrialStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface Trial {
	id: string;
	runId: string;
	modelId: string;
	input: string;
	inputIndex: number;
	output: string | null;
	latencyMs: number | null;
	tokens: number | null;
	status: TrialStatus;
}

// ─── Judgments ────────────────────────────────────────────────────────────────

export interface Verdict {
	trialId: string;
	type: 'verdict';
	pass: boolean;
	error: string | null;
}

export interface Rating {
	trialId: string;
	type: 'rating';
	score: 1 | 2 | 3 | 4 | 5;
}

export interface Ranking {
	runId: string;
	inputIndex: number;
	type: 'ranking';
	modelRanks: { modelId: string; rank: number }[];
}

export type Judgment = Verdict | Rating | Ranking;

// ─── Report ───────────────────────────────────────────────────────────────────

export interface ModelScore {
	modelId: string;
	score: number | null;
	trialCount: number;
}

export interface Report {
	runId: string;
	evalStrategy: EvalStrategy;
	modelScores: ModelScore[];
}

// ─── Aggregate Report ─────────────────────────────────────────────────────────

export interface PlanScore {
	planId: string;
	planName: string;
	/** Score from the most recent scored run that included this model, or null if none. */
	score: number | null;
	/** Number of scored runs for this plan (across all models). */
	runCount: number;
	/** Run ID of the most recent scored run that included this model, for drill-through navigation. */
	runId: string | null;
}

export interface AggregateModelRow {
	modelId: string;
	modelName: string;
	provider: Provider;
	/** Unweighted mean of all non-null plan scores for this model. */
	overallScore: number | null;
	planScores: PlanScore[];
}

export interface PlanSummary {
	planId: string;
	planName: string;
	evalStrategy: EvalStrategy;
	/** Number of complete runs with at least one judgment. */
	runCount: number;
}

export interface AggregateReport {
	/** One row per model, sorted by overallScore descending (nulls last). */
	modelRows: AggregateModelRow[];
	/** One entry per plan in the requested planIds order (plans with no data included). */
	planSummaries: PlanSummary[];
}

// ─── Pluggable adapter interfaces ─────────────────────────────────────────────

export interface LLMCallResult {
	output: string;
	latencyMs: number;
	tokens: number;
}

export interface LLMAdapter {
	call(model: Model, prompt: string, input: string): Promise<LLMCallResult>;
}

export interface MusicRenderer {
	render(output: string, container: HTMLElement): void;
	destroy(): void;
}
