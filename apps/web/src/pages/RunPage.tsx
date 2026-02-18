import RunConfigPanel from '@/components/run/RunConfigPanel';

export default function RunPage() {
	return (
		<div className="flex flex-1 overflow-hidden">
			{/* Left: run configuration — T10 */}
			<div className="w-80 shrink-0 border-r border-border overflow-hidden flex flex-col">
				<RunConfigPanel />
			</div>
			{/* Right: run history — T14 */}
			<div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
				Run history coming soon
			</div>
		</div>
	);
}
