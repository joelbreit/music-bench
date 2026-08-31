import { Outlet } from '@tanstack/react-router';
import RunSelectorPanel from '@/components/explore/RunSelectorPanel';
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from '@/components/ui/resizable';

export default function ExplorePage() {
	return (
		<ResizablePanelGroup className="flex-1">
			{/* Run selector — T19 */}
			<ResizablePanel
				defaultSize="24%"
				minSize="15%"
				maxSize="40%"
				className="border-r border-border overflow-hidden flex flex-col"
			>
				<RunSelectorPanel />
			</ResizablePanel>
			<ResizableHandle withHandle />
			{/* Run report — T20, T21, T22 */}
			<ResizablePanel
				defaultSize="76%"
				className="overflow-hidden flex flex-col"
			>
				<Outlet />
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
