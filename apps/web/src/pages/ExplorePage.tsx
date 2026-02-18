import { Outlet } from '@tanstack/react-router';

export default function ExplorePage() {
	return (
		<div className="flex flex-1 overflow-hidden">
			{/* Run selector — T19 */}
			<aside className="w-72 shrink-0 border-r border-border" />
			{/* Run report — T20, T21, T22 */}
			<Outlet />
		</div>
	);
}
