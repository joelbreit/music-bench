// T13 — Parse Verdict Engine
//
// Executes a plan's parseCode assertion against a trial's output and returns a
// Verdict judgment. Called inline by the run executor for Parse-strategy plans.
//
// Sandbox: new Function() creates an isolated function scope but retains access
// to the global scope (window, etc.). Acceptable for a single-admin personal
// tool where the user writes their own assertion code.

import type { Verdict } from '@/types';
import {
	extractAbc,
	analyzeAbc,
	analyzeLength,
	analyzeRhythm,
	analyzeMeasureAlignment,
} from '@/lib/abcAnalysis';

// Functions injected into the parse assertion sandbox so users can write
// checks like:
//   function assert(output) {
//     const abc = extractAbc(output);
//     if (!abc) return false;
//     const { length } = analyzeAbc(abc);
//     return length.voicesMatch && length.voices[0].bars >= 8;
//   }

export function runParseAssertion(
	trialId: string,
	parseCode: string,
	output: string
): Verdict {
	try {
		const fn = new Function(
			'output',
			'extractAbc',
			'analyzeAbc',
			'analyzeLength',
			'analyzeRhythm',
			'analyzeMeasureAlignment',
			`${parseCode}\nreturn typeof assert === 'function' ? assert(output) : false;`
		);
		const result = fn(
			output,
			extractAbc,
			analyzeAbc,
			analyzeLength,
			analyzeRhythm,
			analyzeMeasureAlignment
		);
		return { trialId, type: 'verdict', pass: Boolean(result), error: null };
	} catch (e) {
		return {
			trialId,
			type: 'verdict',
			pass: false,
			error: e instanceof Error ? e.message : String(e),
		};
	}
}
