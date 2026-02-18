import { Link } from '@tanstack/react-router';

export default function NotFoundPage() {
	return (
		<div className="flex flex-1 items-center justify-center">
			<div className="text-center space-y-3">
				<p className="text-muted-foreground text-sm">Page not found</p>
				<Link
					to="/build"
					className="text-primary text-sm hover:underline"
				>
					Go to Build
				</Link>
			</div>
		</div>
	);
}
