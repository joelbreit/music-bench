import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
	ChevronRight,
	ChevronDown,
	Folder as FolderIcon,
	FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/db';
import { useUIStore } from '@/store';
import type { Folder, Plan } from '@/types';

// ─── Tree builder (same logic as FolderSidebar) ───────────────────────────────

interface FolderNode {
	folder: Folder;
	plans: Plan[];
	children: FolderNode[];
}

function buildTree(
	folders: Folder[],
	plans: Plan[],
	parentId: string | null = null
): FolderNode[] {
	return folders
		.filter((f) => f.parentId === parentId)
		.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
		.map((folder) => ({
			folder,
			plans: plans
				.filter((p) => p.folderId === folder.id)
				.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
			children: buildTree(folders, plans, folder.id),
		}));
}

const STRATEGY_LABEL: Record<Plan['evalStrategy'], string> = {
	parse: 'Parse',
	rate: 'Rate',
	compare: 'Cmp',
};

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function AssessmentFilterPanel() {
	const {
		understandPlanIds,
		toggleUnderstandPlan,
		setUnderstandPlans,
		clearUnderstandPlans,
	} = useUIStore();

	const selectedSet = new Set(understandPlanIds);

	// All folders open by default — track collapsed set
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

	const folders =
		useLiveQuery(() => db.folders.orderBy('createdAt').toArray()) ?? [];
	const plans =
		useLiveQuery(() => db.plans.orderBy('createdAt').toArray()) ?? [];

	// Compute the number of scored (complete + ≥1 judgment) runs per plan.
	// Reactive to any DB change via useLiveQuery.
	const scoredRunCounts =
		useLiveQuery(async () => {
			console.log('[AssessmentFilterPanel] Computing scored run counts');
			const completeRuns = await db.runs
				.where('status')
				.equals('complete')
				.toArray();
			const allPlans = await db.plans.toArray();
			const planMap = new Map(allPlans.map((p) => [p.id, p]));
			const counts = new Map<string, number>();

			for (const run of completeRuns) {
				const plan = planMap.get(run.planId);
				if (!plan) continue;

				const trials = await db.trials
					.where('runId')
					.equals(run.id)
					.toArray();
				const trialIds = trials.map((t) => t.id);

				let hasJudgment = false;
				if (plan.evalStrategy === 'parse') {
					if (trialIds.length > 0) {
						hasJudgment =
							(await db.verdicts
								.where('trialId')
								.anyOf(trialIds)
								.count()) > 0;
					}
				} else if (plan.evalStrategy === 'rate') {
					if (trialIds.length > 0) {
						hasJudgment =
							(await db.ratings
								.where('trialId')
								.anyOf(trialIds)
								.count()) > 0;
					}
				} else {
					hasJudgment =
						(await db.rankings
							.filter((r) => r.runId === run.id)
							.count()) > 0;
				}

				if (hasJudgment) {
					counts.set(run.planId, (counts.get(run.planId) ?? 0) + 1);
				}
			}

			return counts;
		}) ?? new Map<string, number>();

	const selectablePlanIds = plans
		.filter((p) => (scoredRunCounts.get(p.id) ?? 0) > 0)
		.map((p) => p.id);

	const selectedCount = understandPlanIds.length;
	const selectableCount = selectablePlanIds.length;

	const tree = buildTree(folders, plans);

	// ── Handlers ────────────────────────────────────────────────────────────────

	function toggleFolder(id: string) {
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function handleSelectAll() {
		console.log(
			'[AssessmentFilterPanel] Selecting all selectable plans:',
			selectablePlanIds.length
		);
		setUnderstandPlans(selectablePlanIds);
	}

	function handleClear() {
		console.log('[AssessmentFilterPanel] Clearing plan selection');
		clearUnderstandPlans();
	}

	// ── Tree renderer ────────────────────────────────────────────────────────────

	function renderTree(nodes: FolderNode[], depth: number) {
		const folderIndent = 8 + depth * 12;
		const planIndent = folderIndent + 22;

		return nodes.map((node) => {
			const isExpanded = !collapsed.has(node.folder.id);
			const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;
			const FolderIconCmp = isExpanded ? FolderOpen : FolderIcon;

			return (
				<div key={node.folder.id}>
					{/* Folder row */}
					<button
						onClick={() => toggleFolder(node.folder.id)}
						className="flex w-full items-center gap-1.5 py-0.5 pr-1 rounded-md hover:bg-muted transition-colors duration-150"
						style={{ paddingLeft: `${folderIndent}px` }}
					>
						<ChevronIcon
							size={11}
							className="shrink-0 text-dim-foreground"
						/>
						<FolderIconCmp
							size={13}
							className="shrink-0 text-muted-foreground"
						/>
						<span className="flex-1 min-w-0 truncate text-xs font-medium text-foreground text-left">
							{node.folder.name}
						</span>
					</button>

					{/* Plans + subfolders */}
					{isExpanded && (
						<>
							{renderTree(node.children, depth + 1)}
							{node.plans.map((plan) => {
								const runCount =
									scoredRunCounts.get(plan.id) ?? 0;
								const isSelectable = runCount > 0;
								const isSelected = selectedSet.has(plan.id);

								return (
									<label
										key={plan.id}
										className={cn(
											'flex items-center gap-2 py-0.5 pr-2 rounded-md transition-colors duration-150',
											isSelectable
												? 'hover:bg-muted cursor-pointer'
												: 'opacity-40 cursor-not-allowed'
										)}
										style={{
											paddingLeft: `${planIndent}px`,
										}}
									>
										<input
											type="checkbox"
											checked={isSelected}
											disabled={!isSelectable}
											onChange={() => {
												if (!isSelectable) return;
												toggleUnderstandPlan(plan.id);
											}}
											className="shrink-0 h-3 w-3 cursor-pointer disabled:cursor-not-allowed"
										/>
										<span
											className={cn(
												'flex-1 min-w-0 truncate text-xs',
												isSelected
													? 'text-foreground'
													: 'text-muted-foreground'
											)}
										>
											{plan.name}
										</span>
										<span className="shrink-0 text-[10px] text-dim-foreground">
											{STRATEGY_LABEL[plan.evalStrategy]}
										</span>
										{isSelectable && (
											<span className="shrink-0 text-[10px] tabular-nums text-dim-foreground">
												{runCount}
											</span>
										)}
									</label>
								);
							})}
						</>
					)}
				</div>
			);
		});
	}

	// ── Render ──────────────────────────────────────────────────────────────────

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="shrink-0 px-3 py-2 border-b border-border">
				<div className="flex items-center justify-between mb-1.5">
					<span className="text-xs font-medium text-foreground">
						Assessments
					</span>
					<span className="text-[10px] tabular-nums text-dim-foreground">
						{selectedCount} / {selectableCount}
					</span>
				</div>
				<div className="flex gap-1">
					<button
						onClick={handleSelectAll}
						disabled={selectableCount === 0}
						className="text-[10px] px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Select All
					</button>
					<button
						onClick={handleClear}
						disabled={selectedCount === 0}
						className="text-[10px] px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Clear
					</button>
				</div>
			</div>

			{/* Tree */}
			<div className="flex-1 overflow-y-auto py-2 px-1 space-y-px">
				{folders.length === 0 || plans.length === 0 ? (
					<p className="text-xs text-dim-foreground px-2 py-4 text-center">
						No plans yet
					</p>
				) : selectableCount === 0 ? (
					<p className="text-xs text-dim-foreground px-2 py-4 text-center leading-5">
						No scored runs found.
						<br />
						Complete a run with judgments first.
					</p>
				) : (
					renderTree(tree, 0)
				)}
			</div>
		</div>
	);
}
