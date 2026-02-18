// Empty state shown in the right panel when no plan is selected.
// Replaced by actual plan editor content when T5/T7 are implemented.
export default function BuildIndexPage() {
	return (
		<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
			Select a plan to edit, or create a new one
		</div>
	);
}
