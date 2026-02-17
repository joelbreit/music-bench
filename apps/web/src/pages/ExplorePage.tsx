export default function ExplorePage() {
	return (
		<div className="flex flex-1 overflow-hidden">
			{/* Run selector — T19 */}
			<aside className="w-72 shrink-0 border-r border-border" />
			{/* Leaderboard + trial table — T20, T21, T22 */}
			<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
				Explore — select a completed run to view its report
			</div>
		</div>
	);
}
