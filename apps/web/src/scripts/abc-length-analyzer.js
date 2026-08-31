#!/usr/bin/env node
/**
 * abc-length-analyzer.js
 *
 * Demonstrates using abcjs to measure voice and bar lengths in ABC notation.
 * Install with: npm install abcjs
 *
 * Usage:
 *   node abc-length-analyzer.js           # runs built-in examples
 *   node abc-length-analyzer.js tune.abc  # analyzes a file
 */

import abcjs from "abcjs";
import { readFileSync } from "node:fs";

// ---------- Analysis functions ----------

/**
 * Sum the duration of every note/rest in a given voice across all lines.
 * Duration is expressed as a fraction of a whole note (1 = whole note).
 */
function getVoiceLength(tune, staffIdx = 0, voiceIdx = 0) {
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

/** Count barline elements in a voice. */
function countBarlines(tune, staffIdx = 0, voiceIdx = 0) {
  let bars = 0;
  for (const line of tune.lines) {
    const voice = line.staff?.[staffIdx]?.voices?.[voiceIdx];
    if (!voice) continue;
    for (const el of voice) {
      if (el.el_type === "bar") bars++;
    }
  }
  return bars;
}

/** Return [{ staff, voice, length }] for every voice in the tune. */
function getAllVoiceLengths(tune) {
  const results = [];
  const seen = new Set();
  for (const line of tune.lines) {
    if (!line.staff) continue;
    line.staff.forEach((staff, s) => {
      staff.voices?.forEach((_, v) => {
        const key = `${s}:${v}`;
        if (seen.has(key)) return;
        seen.add(key);
        results.push({
          staff: s,
          voice: v,
          length: getVoiceLength(tune, s, v),
          barlines: countBarlines(tune, s, v),
        });
      });
    });
  }
  return results;
}

/** Pretty-print a fraction like 0.75 as "3/4" when reasonable. */
function fmtDuration(d) {
  const denominators = [1, 2, 4, 8, 16, 32];
  for (const denom of denominators) {
    const num = d * denom;
    if (Math.abs(num - Math.round(num)) < 1e-9) {
      return `${Math.round(num)}/${denom} (${d})`;
    }
  }
  return d.toString();
}

// ---------- Main analysis routine ----------

function analyze(label, abcString) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`TUNE: ${label}`);
  console.log("=".repeat(60));

  const tune = abcjs.parseOnly(abcString)[0];

  const barLen = tune.getBarLength();
  console.log(`Bar length:       ${fmtDuration(barLen)} of a whole note`);

  const voices = getAllVoiceLengths(tune);
  console.log(`Voices found:     ${voices.length}`);

  voices.forEach(({ staff, voice, length, barlines }) => {
    const numBars = length / barLen;
    const barsStr = Number.isInteger(numBars)
      ? numBars.toString()
      : numBars.toFixed(3);
    console.log(
      `  staff ${staff}, voice ${voice}:  ` +
        `length=${fmtDuration(length)}  ` +
        `bars=${barsStr}  ` +
        `barlines=${barlines}`
    );
  });

  // Consistency check: all voices should have the same total length
  if (voices.length > 1) {
    const first = voices[0].length;
    const allMatch = voices.every(
      (v) => Math.abs(v.length - first) < 1e-9
    );
    console.log(
      `Voice length check: ${allMatch ? "✓ all voices match" : "✗ MISMATCH"}`
    );
  }
}

// ---------- Examples ----------

const EXAMPLES = {
  "Simple 4/4 tune": `X:1
T:Simple Scale
M:4/4
L:1/4
K:C
CDEF|GABc|cBAG|FEDC|
`,

  "6/8 jig": `X:1
T:Jig Fragment
M:6/8
L:1/8
K:G
GAB def|gfe dBG|GAB def|gfe dBG|
`,

  "Two-voice piece": `X:1
T:Two Voices
M:3/4
L:1/4
K:D
V:1
A2 B|c2 d|e2 f|d3|
V:2
F2 G|A2 B|c2 d|B3|
`,

  "Broken rhythm and tuplet": `X:1
T:Mixed Rhythms
M:4/4
L:1/8
K:G
G>A B>c (3def g2|A>B c>d (3efg a2|
`,
};

function main() {
  const arg = process.argv[2];
  if (arg) {
    const abcString = readFileSync(arg, "utf8");
    analyze(arg, abcString);
  } else {
    for (const [label, abc] of Object.entries(EXAMPLES)) {
      analyze(label, abc);
    }
  }
}

main();
