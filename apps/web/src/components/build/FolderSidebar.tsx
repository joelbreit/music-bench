import { useState, useRef, useEffect } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import {
	ChevronRight,
	ChevronDown,
	MoreHorizontal,
	FolderPlus,
	Pencil,
	Trash2,
	Plus,
	Copy,
	FolderOpen,
	Folder as FolderIcon,
} from 'lucide-react';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { db } from '@/db';
import type { Folder, Plan } from '@/types';

// ─── Tree ─────────────────────────────────────────────────────────────────────

interface FolderNode {
	folder: Folder;
	plans: Plan[];
	children: FolderNode[];
}

function buildTree(folders: Folder[], plans: Plan[], parentId: string | null = null): FolderNode[] {
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

// ─── Plan row ─────────────────────────────────────────────────────────────────

function PlanRow({
	plan,
	isActive,
	indent,
	isRenaming,
	renameValue,
	folders,
	onRenameStart,
	onRenameChange,
	onRenameCommit,
	onRenameCancel,
	onDuplicate,
	onDelete,
	onMoveTo,
}: {
	plan: Plan;
	isActive: boolean;
	indent: number;
	isRenaming: boolean;
	renameValue: string;
	folders: Folder[];
	onRenameStart: () => void;
	onRenameChange: (v: string) => void;
	onRenameCommit: () => void;
	onRenameCancel: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
	onMoveTo: (folderId: string) => void;
}) {
	const navigate = useNavigate();
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isRenaming) {
			inputRef.current?.focus();
			inputRef.current?.select();
		}
	}, [isRenaming]);

	const otherFolders = folders.filter((f) => f.id !== plan.folderId);

	return (
		<div
			className={cn(
				'group flex items-center gap-1 pr-1 py-0.5 rounded-md transition-colors duration-150',
				isActive ? 'bg-accent' : 'hover:bg-muted',
			)}
			style={{ paddingLeft: `${indent}px` }}
		>
			{/* Main click area */}
			<button
				onClick={() => {
					if (isRenaming) return;
					console.log('[FolderSidebar] Navigating to plan:', plan.id);
					navigate({ to: '/build/plan/$planId', params: { planId: plan.id } });
				}}
				tabIndex={isRenaming ? -1 : 0}
				className="flex flex-1 min-w-0 items-center py-0.5 text-left"
			>
				{isRenaming ? (
					<input
						ref={inputRef}
						value={renameValue}
						onChange={(e) => onRenameChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') onRenameCommit();
							if (e.key === 'Escape') onRenameCancel();
						}}
						onBlur={onRenameCommit}
						onClick={(e) => e.stopPropagation()}
						className="flex-1 min-w-0 bg-transparent text-xs text-foreground outline-none border-b border-primary"
					/>
				) : (
					<span
						className={cn(
							'flex-1 truncate text-xs',
							isActive
								? 'text-foreground'
								: 'text-muted-foreground group-hover:text-foreground',
						)}
					>
						{plan.name}
					</span>
				)}
			</button>

			{/* Strategy badge — hidden while renaming */}
			{!isRenaming && (
				<span className="shrink-0 text-[10px] text-dim-foreground">
					{STRATEGY_LABEL[plan.evalStrategy]}
				</span>
			)}

			{/* ⋯ context menu — fades in on row hover */}
			{!isRenaming && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							onClick={(e) => e.stopPropagation()}
							className="shrink-0 flex items-center justify-center h-5 w-5 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
							aria-label={`Options for ${plan.name}`}
						>
							<MoreHorizontal size={12} />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-44">
						<DropdownMenuItem onSelect={onRenameStart}>
							<Pencil size={12} className="mr-2" />
							Rename
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={onDuplicate}>
							<Copy size={12} className="mr-2" />
							Duplicate
						</DropdownMenuItem>
						{otherFolders.length > 0 && (
							<DropdownMenuSub>
								<DropdownMenuSubTrigger>
									<FolderOpen size={12} className="mr-2" />
									Move to folder
								</DropdownMenuSubTrigger>
								<DropdownMenuSubContent className="w-44">
									{otherFolders.map((f) => (
										<DropdownMenuItem key={f.id} onSelect={() => onMoveTo(f.id)}>
											<FolderIcon size={12} className="mr-2" />
											{f.name}
										</DropdownMenuItem>
									))}
								</DropdownMenuSubContent>
							</DropdownMenuSub>
						)}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onSelect={onDelete}
							className="text-error focus:text-error"
						>
							<Trash2 size={12} className="mr-2" />
							Delete plan
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
}

// ─── Folder row ───────────────────────────────────────────────────────────────

function FolderRow({
	folder,
	planCount,
	isExpanded,
	isRenaming,
	renameValue,
	indent,
	onToggle,
	onRenameChange,
	onRenameCommit,
	onRenameCancel,
	onRenameStart,
	onNewPlan,
	onNewSubfolder,
	onDelete,
}: {
	folder: Folder;
	planCount: number;
	isExpanded: boolean;
	isRenaming: boolean;
	renameValue: string;
	indent: number;
	onToggle: () => void;
	onRenameChange: (v: string) => void;
	onRenameCommit: () => void;
	onRenameCancel: () => void;
	onRenameStart: () => void;
	onNewPlan: () => void;
	onNewSubfolder: () => void;
	onDelete: () => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isRenaming) {
			inputRef.current?.focus();
			inputRef.current?.select();
		}
	}, [isRenaming]);

	const Icon = isExpanded ? FolderOpen : FolderIcon;
	const Chevron = isExpanded ? ChevronDown : ChevronRight;

	return (
		<div
			className="group flex items-center gap-0.5 pr-1 py-0.5 rounded-md hover:bg-muted transition-colors duration-150"
			style={{ paddingLeft: `${indent}px` }}
		>
			{/* Clicking the main area toggles expand */}
			<button
				onClick={onToggle}
				tabIndex={isRenaming ? -1 : 0}
				className="flex flex-1 min-w-0 items-center gap-1.5 py-0.5"
			>
				<Chevron size={11} className="shrink-0 text-dim-foreground" />
				<Icon size={13} className="shrink-0 text-muted-foreground" />
				{isRenaming ? (
					<input
						ref={inputRef}
						value={renameValue}
						onChange={(e) => onRenameChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') onRenameCommit();
							if (e.key === 'Escape') onRenameCancel();
						}}
						onBlur={onRenameCommit}
						onClick={(e) => e.stopPropagation()}
						className="flex-1 min-w-0 bg-transparent text-xs text-foreground outline-none border-b border-primary"
					/>
				) : (
					<span className="flex-1 min-w-0 truncate text-xs font-medium text-foreground">
						{folder.name}
					</span>
				)}
			</button>

			{/* Plan count — hidden while renaming */}
			{!isRenaming && planCount > 0 && (
				<span className="shrink-0 text-[10px] text-dim-foreground tabular-nums mr-0.5">
					{planCount}
				</span>
			)}

			{/* ⋯ context menu — fades in on row hover */}
			{!isRenaming && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							onClick={(e) => e.stopPropagation()}
							className="shrink-0 flex items-center justify-center h-5 w-5 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
							aria-label={`Options for ${folder.name}`}
						>
							<MoreHorizontal size={12} />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-44">
						<DropdownMenuItem onSelect={onRenameStart}>
							<Pencil size={12} className="mr-2" />
							Rename
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={onNewPlan}>
							<Plus size={12} className="mr-2" />
							New plan
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={onNewSubfolder}>
							<FolderPlus size={12} className="mr-2" />
							New subfolder
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onSelect={onDelete}
							className="text-error focus:text-error"
						>
							<Trash2 size={12} className="mr-2" />
							Delete folder
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────

export default function FolderSidebar() {
	const navigate = useNavigate();
	// Track *collapsed* folders — all folders are expanded by default,
	// so no effect is needed to initialise from Dexie data.
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
	// Folder rename state
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState('');
	// Plan rename state
	const [renamingPlanId, setRenamingPlanId] = useState<string | null>(null);
	const [planRenameValue, setPlanRenameValue] = useState('');

	const folders = useLiveQuery(() => db.folders.orderBy('createdAt').toArray()) ?? [];
	const plans = useLiveQuery(() => db.plans.orderBy('createdAt').toArray()) ?? [];

	// Read the active plan ID directly from the route
	const activePlanId = useRouterState({
		select: (s) => {
			const m = s.location.pathname.match(/^\/build\/plan\/(.+)/);
			return m ? decodeURIComponent(m[1]) : null;
		},
	});

	const tree = buildTree(folders, plans);

	// ── Folder operations ───────────────────────────────────────────────────────

	function isExpanded(id: string) {
		return !collapsed.has(id);
	}

	function toggleFolder(id: string) {
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}

	function startRename(folder: Folder) {
		console.log('[FolderSidebar] Starting rename for folder:', folder.id);
		setRenamingPlanId(null);
		setPlanRenameValue('');
		setRenamingId(folder.id);
		setRenameValue(folder.name);
	}

	async function commitRename() {
		if (!renamingId) return;
		const trimmed = renameValue.trim();
		if (trimmed) {
			console.log('[FolderSidebar] Renaming folder', renamingId, 'to:', trimmed);
			await db.folders.update(renamingId, { name: trimmed });
		}
		setRenamingId(null);
		setRenameValue('');
	}

	function cancelRename() {
		setRenamingId(null);
		setRenameValue('');
	}

	async function createFolder(parentId: string | null) {
		const id = crypto.randomUUID();
		console.log('[FolderSidebar] Creating folder, parentId:', parentId);
		await db.folders.add({ id, name: 'New Folder', parentId, createdAt: new Date() });
		// Ensure the parent (if any) is not collapsed so the new folder is visible
		if (parentId) {
			setCollapsed((prev) => {
				const next = new Set(prev);
				next.delete(parentId);
				return next;
			});
		}
		// New folder is expanded by default (not in collapsed set)
		setRenamingId(id);
		setRenameValue('New Folder');
	}

	async function deleteTree(node: FolderNode) {
		// Collect all IDs in the subtree
		function collectIds(n: FolderNode, planIds: string[], folderIds: string[]) {
			planIds.push(...n.plans.map((p) => p.id));
			folderIds.push(n.folder.id);
			n.children.forEach((c) => collectIds(c, planIds, folderIds));
		}
		const planIds: string[] = [];
		const folderIds: string[] = [];
		collectIds(node, planIds, folderIds);

		const subCount = folderIds.length - 1;
		const msg = [
			'Delete folder',
			subCount > 0 ? ` and ${subCount} subfolder(s)` : '',
			planIds.length > 0 ? ` and ${planIds.length} plan(s)` : '',
			'? This cannot be undone.',
		].join('');

		if (!window.confirm(msg)) return;

		console.log('[FolderSidebar] Deleting folders:', folderIds, 'plans:', planIds);
		await db.plans.bulkDelete(planIds);
		await db.folders.bulkDelete(folderIds);

		if (activePlanId && planIds.includes(activePlanId)) {
			navigate({ to: '/build' });
		}
	}

	// ── Plan operations ─────────────────────────────────────────────────────────

	function startRenamePlan(plan: Plan) {
		console.log('[FolderSidebar] Starting rename for plan:', plan.id);
		setRenamingId(null);
		setRenameValue('');
		setRenamingPlanId(plan.id);
		setPlanRenameValue(plan.name);
	}

	async function commitRenamePlan() {
		if (!renamingPlanId) return;
		const trimmed = planRenameValue.trim();
		if (trimmed) {
			console.log('[FolderSidebar] Renaming plan', renamingPlanId, 'to:', trimmed);
			await db.plans.update(renamingPlanId, { name: trimmed, updatedAt: new Date() });
		}
		setRenamingPlanId(null);
		setPlanRenameValue('');
	}

	function cancelRenamePlan() {
		setRenamingPlanId(null);
		setPlanRenameValue('');
	}

	async function createPlan(folderId: string) {
		const id = crypto.randomUUID();
		const now = new Date();
		console.log('[FolderSidebar] Creating plan in folder:', folderId);
		await db.plans.add({
			id,
			folderId,
			name: 'New Plan',
			promptTemplate: '',
			inputs: [],
			evalStrategy: 'parse',
			parseCode: null,
			createdAt: now,
			updatedAt: now,
		});
		// Ensure the folder is expanded so the new plan is visible
		setCollapsed((prev) => {
			const next = new Set(prev);
			next.delete(folderId);
			return next;
		});
		// Navigate immediately to the new plan
		navigate({ to: '/build/plan/$planId', params: { planId: id } });
	}

	async function duplicatePlan(plan: Plan) {
		const id = crypto.randomUUID();
		const now = new Date();
		console.log('[FolderSidebar] Duplicating plan:', plan.id);
		await db.plans.add({
			...plan,
			id,
			name: `${plan.name} copy`,
			createdAt: now,
			updatedAt: now,
		});
		navigate({ to: '/build/plan/$planId', params: { planId: id } });
	}

	async function deletePlan(plan: Plan) {
		if (!window.confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
		console.log('[FolderSidebar] Deleting plan:', plan.id);
		await db.plans.delete(plan.id);
		if (activePlanId === plan.id) {
			navigate({ to: '/build' });
		}
	}

	async function movePlanToFolder(plan: Plan, folderId: string) {
		console.log('[FolderSidebar] Moving plan', plan.id, 'to folder:', folderId);
		await db.plans.update(plan.id, { folderId, updatedAt: new Date() });
		// Expand destination folder so the moved plan is visible
		setCollapsed((prev) => {
			const next = new Set(prev);
			next.delete(folderId);
			return next;
		});
	}

	// ── Render ─────────────────────────────────────────────────────────────────

	function renderTree(nodes: FolderNode[], depth: number) {
		const folderIndent = 8 + depth * 12;
		const planIndent = folderIndent + 22;

		return nodes.map((node) => (
			<div key={node.folder.id}>
				<FolderRow
					folder={node.folder}
					planCount={node.plans.length}
					isExpanded={isExpanded(node.folder.id)}
					isRenaming={renamingId === node.folder.id}
					renameValue={renameValue}
					indent={folderIndent}
					onToggle={() => toggleFolder(node.folder.id)}
					onRenameStart={() => startRename(node.folder)}
					onRenameChange={setRenameValue}
					onRenameCommit={commitRename}
					onRenameCancel={cancelRename}
					onNewPlan={() => createPlan(node.folder.id)}
					onNewSubfolder={() => createFolder(node.folder.id)}
					onDelete={() => deleteTree(node)}
				/>
				{isExpanded(node.folder.id) && (
					<>
						{renderTree(node.children, depth + 1)}
						{node.plans.map((plan) => (
							<PlanRow
								key={plan.id}
								plan={plan}
								isActive={plan.id === activePlanId}
								indent={planIndent}
								isRenaming={renamingPlanId === plan.id}
								renameValue={planRenameValue}
								folders={folders}
								onRenameStart={() => startRenamePlan(plan)}
								onRenameChange={setPlanRenameValue}
								onRenameCommit={commitRenamePlan}
								onRenameCancel={cancelRenamePlan}
								onDuplicate={() => duplicatePlan(plan)}
								onDelete={() => deletePlan(plan)}
								onMoveTo={(folderId) => movePlanToFolder(plan, folderId)}
							/>
						))}
					</>
				)}
			</div>
		));
	}

	return (
		<div className="flex flex-col h-full">
			<div className="flex-1 overflow-y-auto py-2 px-1 space-y-px">
				{folders.length === 0 ? (
					<p className="text-xs text-dim-foreground px-2 py-4 text-center">No folders yet</p>
				) : (
					renderTree(tree, 0)
				)}
			</div>
			<div className="shrink-0 px-2 py-2 border-t border-border">
				<button
					onClick={() => createFolder(null)}
					className="flex items-center gap-1.5 w-full px-2 py-1 text-xs text-muted-foreground rounded-md hover:text-foreground hover:bg-muted transition-colors duration-150"
				>
					<Plus size={12} />
					New Folder
				</button>
			</div>
		</div>
	);
}
