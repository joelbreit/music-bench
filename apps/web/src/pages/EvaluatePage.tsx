export default function EvaluatePage() {
	return (
		<div className="flex flex-1 overflow-hidden">
			{/* Evaluation queue — T16 */}
			<aside className="w-72 shrink-0 border-r border-border" />
			{/* Rate / Compare workspace — T17, T18 */}
			<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
				Evaluate — select a run to begin judging
			</div>
		</div>
	);
}
