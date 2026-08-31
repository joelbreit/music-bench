// ABC notation analysis utilities — length and rhythm analysis.
//
// Adapted from src/scripts/abc-length-analyzer.js and rhythm-analyzer.js
// for browser use. All functions operate on raw ABC strings and return
// structured results suitable for display or automated parse assertions.

import abcjs from 'abcjs';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VoiceLength {
	staff: number;
	voice: number;
	/** Total duration in whole-note units (1 = whole note). */
	length: number;
	/** Number of barline elements in this voice. */
	barlines: number;
	/** Computed number of bars (length / barLength). */
	bars: number;
}

export interface LengthAnalysis {
	/** Duration of one bar in whole-note units (from the time signature). */
	barLength: number;
	/** Per-voice lengths. */
	voices: VoiceLength[];
	/** True when all voices have equal total duration. */
	voicesMatch: boolean;
}

export interface RhythmPattern {
	/** Canonical signature string, e.g. "n:0.25,n:0.25,n:0.5". */
	signature: string;
	/** Human-readable description, e.g. "[1 1 2] 8ths". */
	humanized: string;
	/** How many measures use this exact pattern. */
	count: number;
}

export interface VoiceRhythmMap {
	staff: number;
	voice: number;
	/** Short letter ID per measure (A, B, C…) in order of first appearance. */
	measureIds: string[];
}

export interface RhythmAnalysis {
	/** Total number of measures across all voices. */
	totalMeasures: number;
	/** Number of distinct rhythmic patterns. */
	uniquePatterns: number;
	/** totalMeasures / uniquePatterns — higher = more rhythmically repetitive. */
	repetitionRatio: number;
	/** Patterns sorted by frequency (most common first). */
	patterns: RhythmPattern[];
	/** Per-voice measure-by-measure rhythm map. */
	voiceMaps: VoiceRhythmMap[];
	/** Legend mapping letter IDs to pattern descriptions. */
	legend: { id: string; humanized: string }[];
}

export interface MeasureMismatch {
	/** 0-based measure index. */
	measure: number;
	/** Per-voice durations for this measure (staff:voice → duration). */
	voiceDurations: { staff: number; voice: number; duration: number }[];
}

export interface MeasureAlignmentAnalysis {
	/** True when every measure has equal total duration across all voices. */
	aligned: boolean;
	/** Total number of measures (max across voices). */
	measureCount: number;
	/** Number of voices compared. */
	voiceCount: number;
	/** Measures where at least two voices disagree on duration. Empty when aligned. */
	mismatches: MeasureMismatch[];
}

export interface AbcAnalysis {
	length: LengthAnalysis;
	rhythm: RhythmAnalysis;
	measureAlignment: MeasureAlignmentAnalysis;
}

// ─── ABC extraction ──────────────────────────────────────────────────────────

/**
 * Extract ABC notation from an LLM output string.
 * Looks for ```abc fenced blocks first, then plain ``` blocks.
 * Returns null if no ABC content is found.
 */
export function extractAbc(output: string): string | null {
	const match =
		/```abc\n([\s\S]*?)```/.exec(output) ??
		/```\n([\s\S]*?)```/.exec(output);
	return match ? match[1] : null;
}

// ─── Length analysis ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getVoiceLength(tune: any, staffIdx: number, voiceIdx: number): number {
	let total = 0;
	for (const line of tune.lines) {
		if (!line.staff) continue;
		const voice = line.staff[staffIdx]?.voices?.[voiceIdx];
		if (!voice) continue;
		for (const el of voice) {
			if (el.duration) total += el.duration;
		}
	}
	return total;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function countBarlines(tune: any, staffIdx: number, voiceIdx: number): number {
	let bars = 0;
	for (const line of tune.lines) {
		const voice = line.staff?.[staffIdx]?.voices?.[voiceIdx];
		if (!voice) continue;
		for (const el of voice) {
			if (el.el_type === 'bar') bars++;
		}
	}
	return bars;
}

export function analyzeLength(abc: string): LengthAnalysis {
	const tune = abcjs.parseOnly(abc)[0];
	const barLength: number = tune.getBarLength();

	const voices: VoiceLength[] = [];
	const seen = new Set<string>();

	for (const line of tune.lines) {
		if (!line.staff) continue;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		line.staff.forEach((staff: any, s: number) => {
			staff.voices?.forEach((_: unknown, v: number) => {
				const key = `${s}:${v}`;
				if (seen.has(key)) return;
				seen.add(key);
				const length = getVoiceLength(tune, s, v);
				voices.push({
					staff: s,
					voice: v,
					length,
					barlines: countBarlines(tune, s, v),
					bars: barLength > 0 ? length / barLength : 0,
				});
			});
		});
	}

	const voicesMatch =
		voices.length <= 1 ||
		voices.every((v) => Math.abs(v.length - voices[0].length) < 1e-9);

	return { barLength, voices, voicesMatch };
}

// ─── Rhythm analysis ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function splitIntoMeasures(voice: any[]): any[][] {
	const measures: unknown[][] = [];
	let current: unknown[] = [];
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rhythmSignature(measure: any[]): string {
	const tokens: string[] = [];
	for (const el of measure) {
		if (!el.duration) continue;
		const kind = el.rest ? 'r' : 'n';
		const dur = Math.round(el.duration * 10080) / 10080;
		tokens.push(`${kind}:${dur}`);
	}
	return tokens.join(',');
}

function humanizeSignature(sig: string): string {
	if (!sig) return '(empty)';
	const parts = sig.split(',').map((tok) => {
		const [kind, dur] = tok.split(':');
		return { kind, dur: parseFloat(dur) };
	});
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

export function analyzeRhythm(abc: string): RhythmAnalysis {
	const tune = abcjs.parseOnly(abc)[0];
	const patternCounts = new Map<
		string,
		{ count: number; humanized: string }
	>();
	const perVoice: { staff: number; voice: number; sigs: string[] }[] = [];

	for (const line of tune.lines) {
		if (!line.staff) continue;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		line.staff.forEach((staff: any, s: number) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			staff.voices?.forEach((voice: any[], v: number) => {
				const measures = splitIntoMeasures(voice);
				const sigs = measures.map(rhythmSignature);
				perVoice.push({ staff: s, voice: v, sigs });
				for (const sig of sigs) {
					if (!sig) continue;
					const existing = patternCounts.get(sig);
					if (existing) {
						existing.count++;
					} else {
						patternCounts.set(sig, {
							count: 1,
							humanized: humanizeSignature(sig),
						});
					}
				}
			});
		});
	}

	const totalMeasures = perVoice.reduce(
		(sum, v) => sum + v.sigs.filter(Boolean).length,
		0
	);
	const uniquePatterns = patternCounts.size;

	const patterns: RhythmPattern[] = [...patternCounts.entries()]
		.sort((a, b) => b[1].count - a[1].count)
		.map(([signature, info]) => ({
			signature,
			humanized: info.humanized,
			count: info.count,
		}));

	// Assign short IDs (A, B, C…) in order of first appearance
	const idMap = new Map<string, string>();
	let nextId = 0;
	const idFor = (sig: string) => {
		if (!idMap.has(sig)) {
			idMap.set(sig, String.fromCharCode(65 + nextId++));
		}
		return idMap.get(sig)!;
	};

	const voiceMaps: VoiceRhythmMap[] = perVoice.map(
		({ staff, voice, sigs }) => ({
			staff,
			voice,
			measureIds: sigs.map((s) => (s ? idFor(s) : '.')),
		})
	);

	const legend = [...idMap.entries()].map(([sig, id]) => ({
		id,
		humanized: patternCounts.get(sig)!.humanized,
	}));

	return {
		totalMeasures,
		uniquePatterns,
		repetitionRatio:
			uniquePatterns > 0 ? totalMeasures / uniquePatterns : 0,
		patterns,
		voiceMaps,
		legend,
	};
}

// ─── Measure alignment analysis ──────────────────────────────────────────────

/** Sum durations of all note/rest elements in a measure. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function measureDuration(elements: any[]): number {
	let total = 0;
	for (const el of elements) {
		if (el.duration) total += el.duration;
	}
	return total;
}

/**
 * Collect all elements for each unique voice across all lines of the tune,
 * then split into measures by barline. Returns one entry per voice with
 * per-measure durations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPerVoiceMeasureDurations(tune: any): {
	staff: number;
	voice: number;
	durations: number[];
}[] {
	// Accumulate raw element arrays per voice key across all lines.
	const voiceElements = new Map<
		string,
		{ s: number; v: number; els: unknown[] }
	>();

	for (const line of tune.lines) {
		if (!line.staff) continue;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		line.staff.forEach((staff: any, s: number) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			staff.voices?.forEach((voice: any[], v: number) => {
				const key = `${s}:${v}`;
				let entry = voiceElements.get(key);
				if (!entry) {
					entry = { s, v, els: [] };
					voiceElements.set(key, entry);
				}
				entry.els.push(...voice);
			});
		});
	}

	return [...voiceElements.values()].map(({ s, v, els }) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const measures = splitIntoMeasures(els as any[]);
		return {
			staff: s,
			voice: v,
			durations: measures.map(measureDuration),
		};
	});
}

export function analyzeMeasureAlignment(abc: string): MeasureAlignmentAnalysis {
	const tune = abcjs.parseOnly(abc)[0];
	const voiceData = getPerVoiceMeasureDurations(tune);

	if (voiceData.length <= 1) {
		return {
			aligned: true,
			measureCount: voiceData[0]?.durations.length ?? 0,
			voiceCount: voiceData.length,
			mismatches: [],
		};
	}

	const measureCount = Math.max(...voiceData.map((v) => v.durations.length));
	const mismatches: MeasureMismatch[] = [];

	for (let m = 0; m < measureCount; m++) {
		const voiceDurations = voiceData.map((v) => ({
			staff: v.staff,
			voice: v.voice,
			duration: v.durations[m] ?? 0,
		}));
		const first = voiceDurations[0].duration;
		const allMatch = voiceDurations.every(
			(vd) => Math.abs(vd.duration - first) < 1e-9
		);
		if (!allMatch) {
			mismatches.push({ measure: m, voiceDurations });
		}
	}

	return {
		aligned: mismatches.length === 0,
		measureCount,
		voiceCount: voiceData.length,
		mismatches,
	};
}

// ─── Combined analysis ───────────────────────────────────────────────────────

/**
 * Run both length and rhythm analysis on an ABC string.
 * This is the main entry point for use in parse assertions and UI.
 */
export function analyzeAbc(abc: string): AbcAnalysis {
	return {
		length: analyzeLength(abc),
		rhythm: analyzeRhythm(abc),
		measureAlignment: analyzeMeasureAlignment(abc),
	};
}
