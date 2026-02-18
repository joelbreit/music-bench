import { useParams } from '@tanstack/react-router';

export default function ExploreRunPage() {
	const { runId } = useParams({ from: '/explore/$runId' });
	console.log('[ExploreRunPage] runId:', runId);

	return (
		<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
			Run report — T20, T21, T22
		</div>
	);
}
