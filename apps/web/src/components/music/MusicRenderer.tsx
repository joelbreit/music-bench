// T15 — MusicRenderer component
//
// Self-contained rendering surface. Always displays in dark mode regardless of
// the app's current theme, per the design spec.
//
// The `dark` class on the outer wrapper overrides CSS variables to dark-mode
// values for the entire subtree (see @custom-variant dark in index.css).

import { useRenderer } from '@/hooks/useRenderer';

interface Props {
	output: string;
}

export default function MusicRenderer({ output }: Props) {
	const { containerRef, error } = useRenderer(output);

	return (
		// Force dark-mode CSS variables for this subtree
		<div className="dark rounded-md overflow-hidden border border-border">
			<div className="bg-background">
				{error && (
					<div className="px-3 py-2 text-xs text-error border-b border-border">
						Renderer error: {error}
					</div>
				)}
				<div ref={containerRef} />
			</div>
		</div>
	);
}
