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
	// The run that is currently executing (real-time progress updates)
	activeRunId: string | null;
	runProgress: { completed: number; total: number } | null;
	cancelRequested: boolean;
	setActiveRun: (id: string | null) => void;
	setRunProgress: (
		progress: { completed: number; total: number } | null
	) => void;
	requestCancel: () => void;
	clearCancel: () => void;

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
			activeRunId: null,
			runProgress: null,
			cancelRequested: false,
			setActiveRun: (id) => {
				console.log('[store] Active run:', id);
				set({
					activeRunId: id,
					runProgress: null,
					cancelRequested: false,
				});
			},
			setRunProgress: (progress) => set({ runProgress: progress }),
			requestCancel: () => {
				console.log('[store] Cancel requested');
				set({ cancelRequested: true });
			},
			clearCancel: () => set({ cancelRequested: false }),

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
		}),
		{
			name: 'music-bench-ui',
			// Only persist theme; all selection state resets on reload
			partialize: (s) => ({ theme: s.theme }),
		}
	)
);
