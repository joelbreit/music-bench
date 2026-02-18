import { Outlet } from '@tanstack/react-router';
import RunSelectorPanel from '@/components/explore/RunSelectorPanel';

export default function ExplorePage() {
	return (
		<div className="flex flex-1 overflow-hidden">
			{/* Run selector — T19 */}
			<aside className="w-72 shrink-0 border-r border-border overflow-hidden flex flex-col">
				<RunSelectorPanel />
			</aside>
			{/* Run report — T20, T21, T22 */}
			<Outlet />
		</div>
	);
}
