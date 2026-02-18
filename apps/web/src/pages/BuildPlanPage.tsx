import { useParams } from '@tanstack/react-router';

export default function BuildPlanPage() {
	const { planId } = useParams({ from: '/build/plan/$planId' });
	console.log('[BuildPlanPage] planId:', planId);

	return (
		<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
			Plan editor — T7, T8
		</div>
	);
}
