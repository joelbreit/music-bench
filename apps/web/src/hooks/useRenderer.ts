// T15 — useRenderer hook
//
// Manages the lifecycle of a MusicRenderer instance for a given output string.
// Returns a containerRef to attach to a div, and any rendering error.
//
// Usage:
//   const { containerRef, error } = useRenderer(trial.output ?? '');
//   return <div ref={containerRef} />;

import { useEffect, useRef, useState } from 'react';
import { getActiveRenderer } from '@/lib/renderers';

export function useRenderer(output: string): {
	containerRef: React.RefObject<HTMLDivElement | null>;
	error: string | null;
} {
	const containerRef = useRef<HTMLDivElement>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		console.log('[useRenderer] Rendering output, length:', output.length);

		const renderer = getActiveRenderer();

		try {
			renderer.render(output, container);
			setTimeout(() => setError(null), 0);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error('[useRenderer] Render error:', msg);
			setTimeout(() => setError(msg), 0);
		}

		return () => renderer.destroy();
	}, [output]);

	return { containerRef, error };
}
