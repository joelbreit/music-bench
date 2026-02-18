// StubRenderer — default renderer used until a real notation library is configured.
// Displays raw LLM output as a styled monospace block with a notice.

import type { MusicRenderer } from '@/types';

export class StubRenderer implements MusicRenderer {
	render(output: string, container: HTMLElement): void {
		container.innerHTML = '';

		const notice = document.createElement('div');
		notice.className =
			'px-3 py-1.5 text-[11px] text-muted-foreground border-b border-border';
		notice.textContent = 'No renderer configured — raw output';

		const pre = document.createElement('pre');
		pre.className =
			'p-3 text-xs font-mono text-foreground overflow-auto max-h-72 whitespace-pre-wrap break-all';
		pre.textContent = output || '(empty)';

		container.appendChild(notice);
		container.appendChild(pre);
	}

	destroy(): void {
		// Nothing to clean up for the stub renderer.
	}
}
