import { Outlet } from '@tanstack/react-router';
import FolderSidebar from '@/components/build/FolderSidebar';

export default function BuildPage() {
	return (
		<div className="flex flex-1 overflow-hidden">
			<aside className="w-56 shrink-0 border-r border-border">
				<FolderSidebar />
			</aside>
			{/* Plan editor — T7, T8 */}
			<Outlet />
		</div>
	);
}
