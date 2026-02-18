// Renderer registry — maps renderer names to factory functions.
//
// ── How to add a new renderer (e.g. abcjs) ───────────────────────────────────
//
// 1. Create src/lib/renderers/abcjs.ts implementing the MusicRenderer interface:
//
//      import type { MusicRenderer } from '@/types';
//      export class AbcjsRenderer implements MusicRenderer {
//        render(output: string, container: HTMLElement): void {
//          // call ABCJS.renderAbc(container, output, { ... })
//        }
//        destroy(): void {
//          container.innerHTML = '';
//        }
//      }
//
// 2. Add it to RENDERERS below:
//      import { AbcjsRenderer } from './abcjs';
//      const RENDERERS = { stub: ..., abcjs: () => new AbcjsRenderer() };
//
// 3. Set ACTIVE_RENDERER to 'abcjs' (or read from a localStorage config key).
//
// ─────────────────────────────────────────────────────────────────────────────

import type { MusicRenderer } from '@/types';
import { StubRenderer } from './stub';

const RENDERERS: Record<string, () => MusicRenderer> = {
	stub: () => new StubRenderer(),
};

// Change this (or read from localStorage) to switch the active renderer.
const ACTIVE_RENDERER = 'stub';

export function getActiveRenderer(): MusicRenderer {
	const factory = RENDERERS[ACTIVE_RENDERER];
	if (!factory) {
		console.warn(
			'[renderers] Unknown renderer:',
			ACTIVE_RENDERER,
			'— falling back to stub'
		);
		return new StubRenderer();
	}
	return factory();
}
