// T12 — React hook that drives run execution.
//
// Mount in RunPage. Watches activeRunId in the Zustand store; when a new run
// ID is set, the executor fires and drives it to completion (or cancellation).
//
// Progress updates flow back via onProgress → setRunProgress.
// Cancellation is checked between trials via useUIStore.getState().cancelRequested.

import { useEffect } from 'react';
import { useUIStore } from '@/store';
import { executeRun } from '@/lib/runExecutor';

export function useRunExecutor() {
	const activeRunId = useUIStore((s) => s.activeRunId);
	const setRunProgress = useUIStore((s) => s.setRunProgress);
	const setActiveRun = useUIStore((s) => s.setActiveRun);

	useEffect(() => {
		if (!activeRunId) return;
		console.log('[useRunExecutor] Run started:', activeRunId);

		executeRun(
			activeRunId,
			(completed, total) => setRunProgress({ completed, total }),
			() => useUIStore.getState().cancelRequested
		)
			.catch((err: unknown) => {
				console.error(
					'[useRunExecutor] Unexpected error during run:',
					err
				);
			})
			.finally(() => {
				console.log('[useRunExecutor] Run finished:', activeRunId);
				setActiveRun(null);
			});
	}, [activeRunId, setRunProgress, setActiveRun]);
}
