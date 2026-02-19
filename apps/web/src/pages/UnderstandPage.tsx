import { useLiveQuery } from 'dexie-react-hooks';
import AssessmentFilterPanel from '@/components/understand/AssessmentFilterPanel';
import GlobalLeaderboard from '@/components/understand/GlobalLeaderboard';
import ScoreMatrix from '@/components/understand/ScoreMatrix';
import { computeAggregateReport } from '@/lib/computeAggregateReport';
import { useUIStore } from '@/store';

export default function UnderstandPage() {
	const understandPlanIds = useUIStore((s) => s.understandPlanIds);

	// Recompute whenever the plan selection changes or the DB changes.
	// useLiveQuery observes all Dexie table reads made by computeAggregateReport,
	// so it also reruns automatically when runs/judgments are added or deleted.
	const report = useLiveQuery(
		() => computeAggregateReport(understandPlanIds),
		[understandPlanIds.join(',')]
	);

	const selectedCount = understandPlanIds.length;

	return (
		<div className="flex flex-1 overflow-hidden">
			{/* Assessment filter — T28 */}
			<aside className="w-60 shrink-0 border-r border-border overflow-hidden flex flex-col">
				<AssessmentFilterPanel />
			</aside>

			{/* Aggregate results — right panel */}
			<div className="flex-1 overflow-hidden flex flex-col">
				{selectedCount === 0 ? (
					<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
						Select assessments to view aggregate results
					</div>
				) : report === undefined ? (
					<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
						Loading…
					</div>
				) : (
					<>
						{/* Global Leaderboard — T29 */}
						<div className="shrink-0 border-b border-border">
							<GlobalLeaderboard report={report} />
						</div>

						{/* Score Matrix — T30 */}
						<div className="flex-1 overflow-hidden">
							<ScoreMatrix report={report} />
						</div>
					</>
				)}
			</div>
		</div>
	);
}
