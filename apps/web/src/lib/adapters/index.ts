// Adapter registry — maps Model.provider to the correct LLMAdapter.
//
// All providers are currently routed through OpenRouter (D5). If no API key
// is configured, getAdapter() falls back to MockAdapter so the UI can be
// developed and tested without credentials.
//
// To add a new adapter (e.g. a native Anthropic adapter):
//   1. Create src/lib/adapters/anthropic.ts implementing LLMAdapter
//   2. Import it here and add it to the providerMap

import type { LLMAdapter, Model } from '@/types';
import { MockAdapter } from './mock';
import { OpenRouterAdapter } from './openrouter';

const API_KEY_STORAGE = 'mb:openrouter-key';

const mockAdapter = new MockAdapter();
const openRouterAdapter = new OpenRouterAdapter();

export function getAdapter(model: Model): LLMAdapter {
	const hasKey = Boolean(localStorage.getItem(API_KEY_STORAGE));
	if (!hasKey) {
		console.log('[adapters] No API key — using MockAdapter for', model.name);
		return mockAdapter;
	}
	// All providers (anthropic / openai / other) route through OpenRouter.
	// model.apiBase overrides the endpoint when set.
	return openRouterAdapter;
}

export { MockAdapter, OpenRouterAdapter };
