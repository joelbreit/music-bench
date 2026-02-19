import RunConfigPanel from '@/components/run/RunConfigPanel';
import RunHistoryPanel from '@/components/run/RunHistoryPanel';

export default function RunPage() {
	return (
		<div className="flex flex-1 overflow-hidden">
			{/* Left: run configuration */}
			<div className="w-80 shrink-0 border-r border-border overflow-hidden flex flex-col">
				<RunConfigPanel />
			</div>
			{/* Right: run history */}
			<div className="flex-1 overflow-hidden">
				<RunHistoryPanel />
			</div>
		</div>
	);
}
