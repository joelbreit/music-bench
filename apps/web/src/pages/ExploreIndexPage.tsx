// Empty state shown in the report panel when no run is selected.
// Replaced by leaderboard + trial table when T21/T22 are implemented.
export default function ExploreIndexPage() {
	return (
		<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
			Select a completed run to view its report
		</div>
	);
}
