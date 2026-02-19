import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Zustand holds ephemeral UI state only.
// Domain data (Plans, Runs, Trials, Judgments) lives in Dexie and is read
// via useLiveQuery from dexie-react-hooks.

interface UIStore {
	// ── Theme ──────────────────────────────────────────────────────────────
	theme: 'dark' | 'light';
	toggleTheme: () => void;

	// ── Build surface ──────────────────────────────────────────────────────
	// Which plan/folder is open in the editor
	selectedPlanId: string | null;
	selectedFolderId: string | null;
	setSelectedPlan: (id: string | null) => void;
	setSelectedFolder: (id: string | null) => void;

	// ── Run surface ────────────────────────────────────────────────────────
	// Tracks all concurrently executing runs. Each run manages its own
	// progress slot and cancel flag — no global single-run assumption.
	activeRunIds: Set<string>;
	runProgressMap: Map<string, { completed: number; total: number }>;
	cancelRequestedIds: Set<string>;
	addActiveRun: (id: string) => void;
	removeActiveRun: (id: string) => void;
	setRunProgress: (
		runId: string,
		progress: { completed: number; total: number }
	) => void;
	requestCancel: (runId: string) => void;

	// ── Evaluate surface ───────────────────────────────────────────────────
	// Current position in the evaluation workflow
	evalRunId: string | null;
	evalInputIndex: number;
	evalTrialId: string | null;
	setEvalRun: (runId: string | null) => void;
	setEvalInputIndex: (index: number) => void;
	setEvalTrialId: (id: string | null) => void;

	// ── Explore surface ────────────────────────────────────────────────────
	exploreRunId: string | null;
	setExploreRunId: (id: string | null) => void;

	// ── Understand surface ─────────────────────────────────────────────────
	understandPlanIds: string[];
	toggleUnderstandPlan: (planId: string) => void;
	setUnderstandPlans: (planIds: string[]) => void;
	clearUnderstandPlans: () => void;
}

export const useUIStore = create<UIStore>()(
	persist(
		(set) => ({
			// Theme
			theme: 'dark',
			toggleTheme: () => {
				console.log('[store] Toggling theme');
				set((s) => {
					const next = s.theme === 'dark' ? 'light' : 'dark';
					document.documentElement.classList.toggle(
						'dark',
						next === 'dark'
					);
					return { theme: next };
				});
			},

			// Build
			selectedPlanId: null,
			selectedFolderId: null,
			setSelectedPlan: (id) => {
				console.log('[store] Selected plan:', id);
				set({ selectedPlanId: id });
			},
			setSelectedFolder: (id) => {
				console.log('[store] Selected folder:', id);
				set({ selectedFolderId: id });
			},

			// Run
			activeRunIds: new Set<string>(),
			runProgressMap: new Map<
				string,
				{ completed: number; total: number }
			>(),
			cancelRequestedIds: new Set<string>(),
			addActiveRun: (id) => {
				console.log('[store] Adding active run:', id);
				set((s) => ({
					activeRunIds: new Set(s.activeRunIds).add(id),
				}));
			},
			removeActiveRun: (id) => {
				console.log('[store] Removing active run:', id);
				set((s) => {
					const nextIds = new Set(s.activeRunIds);
					nextIds.delete(id);
					const nextProgress = new Map(s.runProgressMap);
					nextProgress.delete(id);
					const nextCancel = new Set(s.cancelRequestedIds);
					nextCancel.delete(id);
					return {
						activeRunIds: nextIds,
						runProgressMap: nextProgress,
						cancelRequestedIds: nextCancel,
					};
				});
			},
			setRunProgress: (runId, progress) => {
				set((s) => ({
					runProgressMap: new Map(s.runProgressMap).set(
						runId,
						progress
					),
				}));
			},
			requestCancel: (runId) => {
				console.log('[store] Cancel requested for run:', runId);
				set((s) => ({
					cancelRequestedIds: new Set(s.cancelRequestedIds).add(
						runId
					),
				}));
			},

			// Evaluate
			evalRunId: null,
			evalInputIndex: 0,
			evalTrialId: null,
			setEvalRun: (runId) => {
				console.log('[store] Eval run:', runId);
				set({ evalRunId: runId, evalInputIndex: 0, evalTrialId: null });
			},
			setEvalInputIndex: (index) => set({ evalInputIndex: index }),
			setEvalTrialId: (id) => set({ evalTrialId: id }),

			// Explore
			exploreRunId: null,
			setExploreRunId: (id) => {
				console.log('[store] Explore run:', id);
				set({ exploreRunId: id });
			},

			// Understand
			understandPlanIds: [],
			toggleUnderstandPlan: (planId) => {
				console.log('[store] Toggle understand plan:', planId);
				set((s) => {
					const has = s.understandPlanIds.includes(planId);
					return {
						understandPlanIds: has
							? s.understandPlanIds.filter((id) => id !== planId)
							: [...s.understandPlanIds, planId],
					};
				});
			},
			setUnderstandPlans: (planIds) => {
				console.log('[store] Set understand plans:', planIds.length);
				set({ understandPlanIds: planIds });
			},
			clearUnderstandPlans: () => {
				console.log('[store] Clear understand plans');
				set({ understandPlanIds: [] });
			},
		}),
		{
			name: 'music-bench-ui',
			// Only persist theme; all selection state resets on reload
			partialize: (s) => ({ theme: s.theme }),
		}
	)
);
