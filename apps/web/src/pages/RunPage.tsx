import RunConfigPanel from '@/components/run/RunConfigPanel';
import RunHistoryPanel from '@/components/run/RunHistoryPanel';
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from '@/components/ui/resizable';

export default function RunPage() {
	return (
		<ResizablePanelGroup
			direction="horizontal"
			autoSaveId="run-panels-v2"
			className="flex-1"
		>
			{/* Left: run configuration */}
			<ResizablePanel
				defaultSize="28%"
				minSize="20%"
				maxSize="50%"
				className="border-r border-border flex flex-col overflow-hidden"
			>
				<RunConfigPanel />
			</ResizablePanel>
			<ResizableHandle withHandle />
			{/* Right: run history */}
			<ResizablePanel defaultSize="72%" className="overflow-hidden">
				<RunHistoryPanel />
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
