// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanImportData {
	name: string;
	folder: string;
	promptTemplate: string;
	inputs: string[];
	evalStrategy: 'parse' | 'rate' | 'compare';
	parseCode: string | null;
}

export type ParseResult =
	| { ok: true; plans: PlanImportData[] }
	| { ok: false; errors: string[] };

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_STRATEGIES = new Set(['parse', 'rate', 'compare']);

function validateOne(
	obj: unknown,
	prefix: string
): { data?: PlanImportData; errors: string[] } {
	if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
		return { errors: [`${prefix}Expected a JSON object`] };
	}

	const o = obj as Record<string, unknown>;
	const errors: string[] = [];

	if (typeof o.name !== 'string' || o.name.trim() === '') {
		errors.push(`${prefix}\`name\` must be a non-empty string`);
	}

	if (
		typeof o.promptTemplate !== 'string' ||
		o.promptTemplate.trim() === ''
	) {
		errors.push(`${prefix}\`promptTemplate\` must be a non-empty string`);
	} else if (!o.promptTemplate.includes('{{input}}')) {
		errors.push(`${prefix}\`promptTemplate\` must contain {{input}}`);
	}

	if (!Array.isArray(o.inputs) || o.inputs.length === 0) {
		errors.push(`${prefix}\`inputs\` must be a non-empty array`);
	} else {
		(o.inputs as unknown[]).forEach((inp, i) => {
			if (typeof inp !== 'string' || inp.trim() === '') {
				errors.push(
					`${prefix}\`inputs[${i}]\` must be a non-empty string`
				);
			}
		});
	}

	if (!VALID_STRATEGIES.has(o.evalStrategy as string)) {
		errors.push(
			`${prefix}\`evalStrategy\` must be "parse", "rate", or "compare"`
		);
	}

	const strategy = o.evalStrategy as string;
	if (strategy === 'parse') {
		if (typeof o.parseCode !== 'string' || o.parseCode.trim() === '') {
			errors.push(
				`${prefix}\`parseCode\` must be a non-empty string when evalStrategy is "parse"`
			);
		}
	}

	if (errors.length > 0) return { errors };

	return {
		data: {
			name: (o.name as string).trim(),
			folder:
				typeof o.folder === 'string' && o.folder.trim()
					? o.folder.trim()
					: 'Imported',
			promptTemplate: o.promptTemplate as string,
			inputs: (o.inputs as string[]).map((s) => s.trim()),
			evalStrategy: strategy as 'parse' | 'rate' | 'compare',
			parseCode: strategy === 'parse' ? (o.parseCode as string) : null,
		},
		errors: [],
	};
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse and validate a JSON string as one or more plan import objects.
 * Accepts both a single plan object and an array of plan objects.
 */
export function parsePlanJson(text: string): ParseResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text.trim());
	} catch (e) {
		return {
			ok: false,
			errors: [
				`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
			],
		};
	}

	const items = Array.isArray(parsed) ? parsed : [parsed];

	if (items.length === 0) {
		return { ok: false, errors: ['Array is empty — nothing to import'] };
	}

	const allErrors: string[] = [];
	const plans: PlanImportData[] = [];

	items.forEach((item, i) => {
		const prefix = items.length > 1 ? `[${i + 1}] ` : '';
		const { data, errors } = validateOne(item, prefix);
		allErrors.push(...errors);
		if (data) plans.push(data);
	});

	if (allErrors.length > 0) return { ok: false, errors: allErrors };
	return { ok: true, plans };
}
