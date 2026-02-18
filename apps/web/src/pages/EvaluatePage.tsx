import { Outlet } from '@tanstack/react-router';
import EvalQueuePanel from '@/components/evaluate/EvalQueuePanel';

export default function EvaluatePage() {
	return (
		<div className="flex flex-1 overflow-hidden">
			{/* Evaluation queue — T16 */}
			<aside className="w-72 shrink-0 border-r border-border overflow-hidden flex flex-col">
				<EvalQueuePanel />
			</aside>
			{/* Rate / Compare workspace — T17, T18 */}
			<Outlet />
		</div>
	);
}
