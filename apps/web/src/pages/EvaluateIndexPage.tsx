// Empty state shown in the workspace panel when no run is selected.
// Replaced by Rate/Compare workspace when T17/T18 are implemented.
export default function EvaluateIndexPage() {
	return (
		<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
			Select a run from the queue to begin evaluating
		</div>
	);
}
