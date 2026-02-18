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
	Folder as FolderIcon,
	FolderOpen,
} from 'lucide-react';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
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

function PlanRow({ plan, isActive, indent }: { plan: Plan; isActive: boolean; indent: number }) {
	const navigate = useNavigate();

	return (
		<button
			onClick={() => {
				console.log('[FolderSidebar] Navigating to plan:', plan.id);
				navigate({ to: '/build/plan/$planId', params: { planId: plan.id } });
			}}
			className={cn(
				'w-full flex items-center gap-2 pr-2 py-1 rounded-md text-left transition-colors duration-150',
				isActive
					? 'bg-accent text-foreground'
					: 'text-muted-foreground hover:text-foreground hover:bg-muted',
			)}
			style={{ paddingLeft: `${indent}px` }}
		>
			<span className="flex-1 truncate text-xs">{plan.name}</span>
			<span className="shrink-0 text-[10px] text-dim-foreground">
				{STRATEGY_LABEL[plan.evalStrategy]}
			</span>
		</button>
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
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState('');

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

	// ── Operations ─────────────────────────────────────────────────────────────

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
