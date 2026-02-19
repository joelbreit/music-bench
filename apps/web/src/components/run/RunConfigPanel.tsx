import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Play, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/db';
import { useUIStore } from '@/store';
import type { Plan, Provider } from '@/types';

// ─── Provider badge ────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<Provider, string> = {
	anthropic: 'Anthropic',
	openai: 'OpenAI',
	google: 'Google',
	xai: 'xAI',
	deepseek: 'DeepSeek',
	moonshot: 'MoonshotAI',
	other: 'Other',
};

const PROVIDER_COLORS: Record<Provider, string> = {
	anthropic: 'bg-chart-1/15 text-chart-1',
	openai: 'bg-chart-2/15 text-chart-2',
	google: 'bg-chart-3/15 text-chart-3',
	xai: 'bg-chart-8/15 text-chart-8',
	deepseek: 'bg-chart-5/15 text-chart-5',
	moonshot: 'bg-chart-7/15 text-chart-7',
	other: 'bg-muted text-muted-foreground',
};

function ProviderBadge({ provider }: { provider: Provider }) {
	return (
		<span
			className={cn(
				'shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
				PROVIDER_COLORS[provider]
			)}
		>
			{PROVIDER_LABELS[provider]}
		</span>
	);
}

// ─── Run config panel ──────────────────────────────────────────────────────────

export default function RunConfigPanel() {
	const [selectedPlanId, setSelectedPlanId] = useState<string>('');
	const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(
		new Set()
	);

	const { activeRunId, runProgress, requestCancel } = useUIStore();

	const folders = useLiveQuery(() => db.folders.toArray()) ?? [];
	const plans = useLiveQuery(() => db.plans.toArray()) ?? [];
	const allModels = useLiveQuery(() => db.models.toArray()) ?? [];
	const models = allModels.filter((m) => m.enabled);

	const selectedPlan: Plan | null =
		plans.find((p) => p.id === selectedPlanId) ?? null;

	// Validation
	const hasPlan = selectedPlan !== null;
	const planHasInputs = hasPlan && selectedPlan.inputs.length > 0;
	const hasModels = selectedModelIds.size > 0;
	const isRunning = activeRunId !== null;
	const canLaunch = hasPlan && planHasInputs && hasModels && !isRunning;

	// Group plans by folder for <optgroup>
	const folderMap = new Map(folders.map((f) => [f.id, f]));
	const plansByFolder = new Map<string, Plan[]>();
	for (const plan of plans) {
		const group = plansByFolder.get(plan.folderId) ?? [];
		group.push(plan);
		plansByFolder.set(plan.folderId, group);
	}

	const allSelected =
		models.length > 0 && models.every((m) => selectedModelIds.has(m.id));

	function toggleAll() {
		if (allSelected) {
			console.log('[RunConfigPanel] Deselecting all models');
			setSelectedModelIds(new Set());
		} else {
			console.log('[RunConfigPanel] Selecting all models');
			setSelectedModelIds(new Set(models.map((m) => m.id)));
		}
	}

	function toggleModel(modelId: string) {
		setSelectedModelIds((prev) => {
			const next = new Set(prev);
			if (next.has(modelId)) next.delete(modelId);
			else next.add(modelId);
			return next;
		});
	}

	async function handleLaunch() {
		if (!canLaunch || !selectedPlan) return;
		const runId = crypto.randomUUID();
		const modelIds = [...selectedModelIds];
		console.log(
			'[RunConfigPanel] Launching run:',
			runId,
			'plan:',
			selectedPlanId,
			'models:',
			modelIds
		);
		await db.runs.add({
			id: runId,
			planId: selectedPlanId,
			modelIds,
			status: 'queued',
			startedAt: new Date(),
			completedAt: null,
		});
		useUIStore.getState().setActiveRun(runId);
	}

	function handleStop() {
		console.log('[RunConfigPanel] Stop requested');
		requestCancel();
	}

	const progressPct = runProgress
		? Math.round((runProgress.completed / runProgress.total) * 100)
		: 0;

	return (
		<div className="flex flex-col h-full p-5 gap-6 overflow-y-auto">
			{/* ── Plan selector ── */}
			<div className="space-y-2">
				<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
					Plan
				</p>
				<select
					value={selectedPlanId}
					onChange={(e) => {
						console.log(
							'[RunConfigPanel] Plan selected:',
							e.target.value
						);
						setSelectedPlanId(e.target.value);
					}}
					className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
					disabled={isRunning}
				>
					<option value="">Select a plan…</option>
					{[...plansByFolder.entries()].map(
						([folderId, folderPlans]) => (
							<optgroup
								key={folderId}
								label={
									folderMap.get(folderId)?.name ??
									'Unknown folder'
								}
							>
								{folderPlans.map((plan) => (
									<option key={plan.id} value={plan.id}>
										{plan.name}
									</option>
								))}
							</optgroup>
						)
					)}
				</select>

				{selectedPlan && (
					<p className="text-[11px] text-muted-foreground">
						{selectedPlan.inputs.length} input
						{selectedPlan.inputs.length !== 1 ? 's' : ''}
						{' · '}
						<span className="capitalize">
							{selectedPlan.evalStrategy}
						</span>{' '}
						eval
					</p>
				)}

				{hasPlan && !planHasInputs && (
					<p className="text-[11px] text-warning">
						This plan has no inputs. Add at least one input in the
						Build surface.
					</p>
				)}
			</div>

			{/* ── Model multi-select ── */}
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
						Models
					</p>
					{models.length > 0 && (
						<button
							type="button"
							onClick={toggleAll}
							disabled={isRunning}
							className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-default transition-colors duration-150"
						>
							{allSelected ? 'Deselect all' : 'Select all'}
						</button>
					)}
				</div>

				{models.length === 0 ? (
					<p className="text-sm text-dim-foreground py-1">
						No models enabled — configure models in Settings.
					</p>
				) : (
					<div className="space-y-0.5">
						{models.map((model) => (
							<label
								key={model.id}
								className={cn(
									'flex items-center gap-2.5 py-1.5 px-2 rounded-md cursor-pointer',
									isRunning
										? 'opacity-50 cursor-default'
										: 'hover:bg-muted'
								)}
							>
								<input
									type="checkbox"
									checked={selectedModelIds.has(model.id)}
									onChange={() =>
										!isRunning && toggleModel(model.id)
									}
									disabled={isRunning}
									className="shrink-0 accent-primary"
								/>
								<span className="flex-1 min-w-0 text-sm font-mono text-foreground truncate">
									{model.name}
								</span>
								<ProviderBadge provider={model.provider} />
							</label>
						))}
					</div>
				)}
			</div>

			{/* ── Launch / Stop ── */}
			<div className="space-y-3 mt-auto">
				{isRunning && runProgress && (
					<div className="space-y-1.5">
						<div className="flex justify-between text-[11px] text-muted-foreground">
							<span>Running…</span>
							<span>
								{runProgress.completed} / {runProgress.total}{' '}
								trials
							</span>
						</div>
						<div className="h-1 bg-muted rounded-full overflow-hidden">
							<div
								className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
								style={{ width: `${progressPct}%` }}
							/>
						</div>
					</div>
				)}

				{isRunning ? (
					<button
						type="button"
						onClick={handleStop}
						className="flex items-center gap-1.5 w-full justify-center rounded-md border border-error/30 bg-error/10 text-error hover:bg-error/20 px-4 py-2 text-sm font-medium transition-colors duration-150"
					>
						<Square size={13} />
						Stop Run
					</button>
				) : (
					<button
						type="button"
						onClick={handleLaunch}
						disabled={!canLaunch}
						className="flex items-center gap-1.5 w-full justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-default px-4 py-2 text-sm font-medium transition-colors duration-150"
					>
						<Play size={13} />
						Launch Run
					</button>
				)}

				{!isRunning && !hasModels && models.length > 0 && (
					<p className="text-[11px] text-muted-foreground text-center">
						Select at least one model to continue
					</p>
				)}
			</div>
		</div>
	);
}
