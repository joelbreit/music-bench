import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractAbc, analyzeAbc, type AbcAnalysis } from '@/lib/abcAnalysis';

interface Props {
	output: string;
}

function fmtDuration(d: number): string {
	const denominators = [1, 2, 4, 8, 16, 32];
	for (const denom of denominators) {
		const num = d * denom;
		if (Math.abs(num - Math.round(num)) < 1e-9) {
			return `${Math.round(num)}/${denom}`;
		}
	}
	return d.toFixed(4);
}

export default function AbcAnalysisPanel({ output }: Props) {
	const [expanded, setExpanded] = useState(false);

	const analysis = useMemo((): AbcAnalysis | null => {
		const abc = extractAbc(output);
		if (!abc) return null;
		try {
			return analyzeAbc(abc);
		} catch (e) {
			console.warn('[AbcAnalysisPanel] Analysis failed:', e);
			return null;
		}
	}, [output]);

	if (!analysis) return null;

	const { length, rhythm } = analysis;

	return (
		<div>
			<button
				type="button"
				onClick={() => {
					console.log(
						'[AbcAnalysisPanel] Toggle analysis:',
						!expanded
					);
					setExpanded((v) => !v);
				}}
				className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
			>
				<BarChart3 size={12} />
				<span
					className={cn(
						'transition-transform duration-150',
						expanded && 'rotate-90'
					)}
				>
					▶
				</span>
				ABC Analysis
			</button>

			{expanded && (
				<div className="mt-2 p-3 bg-muted rounded-md text-xs font-mono space-y-3">
					{/* ── Length ── */}
					<div>
						<p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
							Length
						</p>
						<p>
							Bar length: {fmtDuration(length.barLength)} of a
							whole note
						</p>
						{length.voices.map((v) => (
							<p key={`${v.staff}:${v.voice}`}>
								Staff {v.staff} Voice {v.voice}:{' '}
								{fmtDuration(v.length)} total,{' '}
								{Number.isInteger(v.bars)
									? v.bars
									: v.bars.toFixed(2)}{' '}
								bars, {v.barlines} barlines
							</p>
						))}
						{length.voices.length > 1 && (
							<p
								className={
									length.voicesMatch
										? 'text-success'
										: 'text-destructive'
								}
							>
								{length.voicesMatch
									? '✓ All voices match'
									: '✗ Voice lengths MISMATCH'}
							</p>
						)}
					</div>

					{/* ── Rhythm ── */}
					<div>
						<p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
							Rhythm
						</p>
						<p>
							{rhythm.totalMeasures} measures,{' '}
							{rhythm.uniquePatterns} unique patterns,{' '}
							{rhythm.repetitionRatio.toFixed(2)}× repetition
						</p>

						{/* Pattern frequency */}
						<div className="mt-1 space-y-0.5">
							{rhythm.patterns.map((p, i) => {
								const pct =
									rhythm.totalMeasures > 0
										? Math.round(
												(p.count /
													rhythm.totalMeasures) *
													100
											)
										: 0;
								return (
									<p key={i}>
										{p.humanized} — {p.count}× ({pct}%)
									</p>
								);
							})}
						</div>

						{/* Rhythm map */}
						{rhythm.voiceMaps.length > 0 && (
							<div className="mt-2">
								<p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
									Rhythm Map
								</p>
								{rhythm.voiceMaps.map((vm) => (
									<p key={`${vm.staff}:${vm.voice}`}>
										S{vm.staff}V{vm.voice}:{' '}
										{vm.measureIds.join(' ')}
									</p>
								))}
								<div className="mt-1 text-muted-foreground">
									{rhythm.legend.map((l) => (
										<span key={l.id} className="mr-3">
											{l.id}={l.humanized}
										</span>
									))}
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
