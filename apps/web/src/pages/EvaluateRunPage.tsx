import { useParams } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import RateMode from '@/components/evaluate/RateMode';
import CompareMode from '@/components/evaluate/CompareMode';

export default function EvaluateRunPage() {
	const { runId } = useParams({ from: '/evaluate/$runId' });
	console.log('[EvaluateRunPage] runId:', runId);

	const data = useLiveQuery(async () => {
		const run = await db.runs.get(runId);
		if (!run) return null;
		const plan = await db.plans.get(run.planId);
		if (!plan) return null;
		return { run, plan };
	}, [runId]);

	if (data === undefined) {
		return (
			<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
				Loading…
			</div>
		);
	}

	if (data === null) {
		return (
			<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
				Run not found
			</div>
		);
	}

	const { run, plan } = data;

	if (plan.evalStrategy === 'rate') {
		return (
			<div className="flex-1 overflow-hidden flex flex-col">
				<RateMode key={runId} run={run} plan={plan} />
			</div>
		);
	}

	if (plan.evalStrategy === 'compare') {
		return (
			<div className="flex-1 overflow-hidden flex flex-col">
				<CompareMode key={runId} run={run} plan={plan} />
			</div>
		);
	}

	return (
		<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
			Unexpected eval strategy: {plan.evalStrategy}
		</div>
	);
}
