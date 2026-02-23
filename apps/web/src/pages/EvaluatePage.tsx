import { Outlet } from '@tanstack/react-router';
import EvalQueuePanel from '@/components/evaluate/EvalQueuePanel';
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from '@/components/ui/resizable';

export default function EvaluatePage() {
	return (
		<ResizablePanelGroup
			direction="horizontal"
			autoSaveId="evaluate-panels-v2"
			className="flex-1"
		>
			{/* Evaluation queue — T16 */}
			<ResizablePanel
				defaultSize="24%"
				minSize="15%"
				maxSize="40%"
				className="border-r border-border overflow-hidden flex flex-col"
			>
				<EvalQueuePanel />
			</ResizablePanel>
			<ResizableHandle withHandle />
			{/* Rate / Compare workspace — T17, T18 */}
			<ResizablePanel
				defaultSize="76%"
				className="overflow-hidden flex flex-col"
			>
				<Outlet />
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
