import type { LLMAdapter, LLMCallResult, Model } from '@/types';

const DEFAULT_DELAY_MS = 500;

// Monotonic counter so each call produces a distinct label even within a run.
let callCount = 0;

export class MockAdapter implements LLMAdapter {
	async call(
		_model: Model,
		_prompt: string,
		input: string
	): Promise<LLMCallResult> {
		const index = ++callCount;
		const start = Date.now();
		await new Promise<void>((r) => setTimeout(r, DEFAULT_DELAY_MS));

		// Produce ABC notation that passes a basic header assertion.
		const output = [
			`X:${index}`,
			`T:Mock output for "${input}"`,
			`M:4/4`,
			`L:1/8`,
			`K:C`,
			`|: CDEF GABC' :|`,
		].join('\n');

		return {
			output,
			latencyMs: Date.now() - start,
			tokens: 40 + Math.floor(Math.random() * 20),
		};
	}
}
