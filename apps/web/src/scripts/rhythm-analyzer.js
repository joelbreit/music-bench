#!/usr/bin/env node
/**
 * rhythm-analyzer.js
 *
 * Extracts the rhythmic pattern of each measure in an ABC tune and reports
 * how often each pattern recurs, independent of pitch.
 */

import abcjs from 'abcjs';
import { readFileSync } from 'node:fs';

/**
 * Walk a voice and split its elements into measures.
 * Returns an array of arrays, where each inner array is the elements of one bar.
 * Barline elements themselves are excluded.
 */
function splitIntoMeasures(voice) {
	const measures = [];
	let current = [];
	for (const el of voice) {
		if (el.el_type === 'bar') {
			if (current.length) measures.push(current);
			current = [];
		} else {
			current.push(el);
		}
	}
	if (current.length) measures.push(current);
	return measures;
}

/**
 * Turn a measure into a rhythm signature: a sequence of durations plus a
 * rest/note marker. Two measures with identical signatures have identical
 * rhythm regardless of pitch.
 *
 * Format: "r:0.25,n:0.25,n:0.5" where r=rest, n=note(or chord).
 */
function rhythmSignature(measure) {
	const tokens = [];
	for (const el of measure) {
		if (!el.duration) continue; // skip non-rhythmic elements
		const kind = el.rest ? 'r' : 'n';
		// Round to avoid floating-point noise (1/48 precision is plenty)
		const dur = Math.round(el.duration * 10080) / 10080;
		tokens.push(`${kind}:${dur}`);
	}
	return tokens.join(',');
}

/** Pretty-print a rhythm signature as "note lengths in eighths" or similar. */
function humanizeSignature(sig, barLength) {
	if (!sig) return '(empty)';
	// Express durations as multiples of the shortest value in the bar
	const parts = sig.split(',').map((tok) => {
		const [kind, dur] = tok.split(':');
		return { kind, dur: parseFloat(dur) };
	});
	// Find a reasonable unit — try eighths first, then sixteenths
	const units = [
		{ name: '8th', value: 1 / 8 },
		{ name: '16th', value: 1 / 16 },
		{ name: '4th', value: 1 / 4 },
	];
	for (const unit of units) {
		const scaled = parts.map((p) => p.dur / unit.value);
		if (scaled.every((n) => Math.abs(n - Math.round(n)) < 1e-6)) {
			const strs = parts.map((p, i) => {
				const n = Math.round(scaled[i]);
				return p.kind === 'r' ? `${n}r` : `${n}`;
			});
			return `[${strs.join(' ')}] ${unit.name}s`;
		}
	}
	return sig;
}

/** Main analysis: collect rhythm patterns across all voices in the tune. */
function analyzeRhythms(tune) {
	const patternCounts = new Map(); // signature -> { count, example, humanized }
	const perVoice = [];

	for (const line of tune.lines) {
		if (!line.staff) continue;
		line.staff.forEach((staff, s) => {
			staff.voices?.forEach((voice, v) => {
				const measures = splitIntoMeasures(voice);
				const sigs = measures.map(rhythmSignature);
				perVoice.push({ staff: s, voice: v, measureSigs: sigs });
				sigs.forEach((sig) => {
					if (!sig) return;
					const existing = patternCounts.get(sig);
					if (existing) {
						existing.count++;
					} else {
						patternCounts.set(sig, {
							count: 1,
							humanized: humanizeSignature(
								sig,
								tune.getBarLength()
							),
						});
					}
				});
			});
		});
	}

	return { patternCounts, perVoice };
}

function report(label, abcString) {
	console.log(`\n${'='.repeat(64)}`);
	console.log(`TUNE: ${label}`);
	console.log('='.repeat(64));

	const tune = abcjs.parseOnly(abcString)[0];
	const { patternCounts, perVoice } = analyzeRhythms(tune);

	const totalMeasures = perVoice.reduce(
		(sum, v) => sum + v.measureSigs.filter(Boolean).length,
		0
	);
	const uniquePatterns = patternCounts.size;

	console.log(`Total measures:    ${totalMeasures}`);
	console.log(`Unique rhythms:    ${uniquePatterns}`);
	console.log(
		`Repetition ratio:  ${(totalMeasures / uniquePatterns).toFixed(2)}x ` +
			`(higher = more rhythmically repetitive)`
	);

	console.log('\nPattern frequency (most common first):');
	const sorted = [...patternCounts.entries()].sort(
		(a, b) => b[1].count - a[1].count
	);
	sorted.forEach(([sig, info], i) => {
		const pct = ((info.count / totalMeasures) * 100).toFixed(0);
		console.log(
			`  ${(i + 1).toString().padStart(2)}. ${info.humanized.padEnd(30)} ` +
				`${info.count}x (${pct}%)`
		);
	});

	// Show per-voice measure-by-measure rhythm map
	console.log('\nMeasure-by-measure rhythm map:');
	// Assign short IDs (A, B, C...) to each unique rhythm in order of first appearance
	const idMap = new Map();
	let nextId = 0;
	const idFor = (sig) => {
		if (!idMap.has(sig)) {
			idMap.set(sig, String.fromCharCode(65 + nextId++));
		}
		return idMap.get(sig);
	};
	perVoice.forEach(({ staff, voice, measureSigs }) => {
		const ids = measureSigs.map((s) => (s ? idFor(s) : '.'));
		console.log(`  staff ${staff} voice ${voice}: ${ids.join(' ')}`);
	});

	console.log('\nRhythm legend:');
	[...idMap.entries()].forEach(([sig, id]) => {
		const info = patternCounts.get(sig);
		console.log(`  ${id} = ${info.humanized}`);
	});
}

// ---------- Examples ----------

const EXAMPLES = {
	'Repetitive jig': `X:1
T:Jig with repeated rhythm
M:6/8
L:1/8
K:G
GAB def|gfe dBG|GAB def|gfe dBG|
cba gfe|dcB AGF|GAB cde|fed cBA|
`,

	'Varied 4/4 piece': `X:1
T:Mixed rhythms
M:4/4
L:1/8
K:D
A2 B2 c2 d2|ABcd efga|a4 z4|A2 B2 c2 d2|
ABcd efga|d2 d2 d2 d2|A2 B2 c2 d2|d8|
`,

	'Two voices same rhythm': `X:1
T:Parallel rhythm
M:4/4
L:1/4
K:C
V:1
C D E F|G A B c|c B A G|F E D C|
V:2
E F G A|B c d e|e d c B|A G F E|
`,
};

function main() {
	const arg = process.argv[2];
	if (arg) {
		report(arg, readFileSync(arg, 'utf8'));
	} else {
		for (const [label, abc] of Object.entries(EXAMPLES)) {
			report(label, abc);
		}
	}
}

main();
