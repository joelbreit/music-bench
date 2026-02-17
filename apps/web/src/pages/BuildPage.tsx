export default function BuildPage() {
	return (
		<div className="flex flex-1 overflow-hidden">
			{/* Folder/plan sidebar — T5, T6 */}
			<aside className="w-56 shrink-0 border-r border-border" />
			{/* Plan editor — T7, T8 */}
			<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
				Build — select or create a plan
			</div>
		</div>
	);
}
