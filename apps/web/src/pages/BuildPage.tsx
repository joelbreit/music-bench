import { Outlet } from '@tanstack/react-router';
import FolderSidebar from '@/components/build/FolderSidebar';
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from '@/components/ui/resizable';

export default function BuildPage() {
	return (
		<ResizablePanelGroup className="flex-1">
			<ResizablePanel
				defaultSize="22%"
				minSize="15%"
				maxSize="40%"
				className="border-r border-border"
			>
				<FolderSidebar />
			</ResizablePanel>
			<ResizableHandle withHandle />
			{/* Plan editor — T7, T8 */}
			<ResizablePanel defaultSize="78%">
				<Outlet />
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
