import type { LLMAdapter, LLMCallResult, Model } from '@/types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY_STORAGE = 'mb:openrouter-key';

export class OpenRouterAdapter implements LLMAdapter {
	async call(model: Model, prompt: string): Promise<LLMCallResult> {
		const apiKey = localStorage.getItem(API_KEY_STORAGE) ?? '';
		if (!apiKey) {
			throw new Error(
				'OpenRouter API key not configured. Add it in Settings.'
			);
		}

		const url = model.apiBase ?? OPENROUTER_URL;
		console.log('[OpenRouterAdapter] Calling', model.name, 'via', url);

		const start = Date.now();
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
				'HTTP-Referer': window.location.origin,
			},
			body: JSON.stringify({
				model: model.name,
				messages: [{ role: 'user', content: prompt }],
			}),
		});

		const latencyMs = Date.now() - start;

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`OpenRouter ${res.status}: ${text}`);
		}

		const data = (await res.json()) as {
			choices?: { message?: { content?: string } }[];
			usage?: { total_tokens?: number };
		};

		const output = data.choices?.[0]?.message?.content ?? '';
		const tokens = data.usage?.total_tokens ?? 0;

		console.log(
			'[OpenRouterAdapter] Done:',
			model.name,
			`${latencyMs}ms`,
			`${tokens} tokens`
		);
		return { output, latencyMs, tokens };
	}
}
