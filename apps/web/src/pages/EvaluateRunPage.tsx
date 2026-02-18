import { useParams } from '@tanstack/react-router';

export default function EvaluateRunPage() {
	const { runId } = useParams({ from: '/evaluate/$runId' });
	console.log('[EvaluateRunPage] runId:', runId);

	return (
		<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
			Evaluate workspace — T17, T18
		</div>
	);
}
