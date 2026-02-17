import { Link, useRouterState } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
	{ to: '/build', label: 'Build' },
	{ to: '/run', label: 'Run' },
	{ to: '/evaluate', label: 'Evaluate' },
	{ to: '/explore', label: 'Explore' },
] as const;

function NavLink({ to, label }: { to: string; label: string }) {
	const isActive = useRouterState({
		select: (s) => s.location.pathname.startsWith(to),
	});

	return (
		<Link
			to={to}
			className={cn(
				'px-3 py-1 text-sm rounded-md transition-colors duration-150',
				isActive
					? 'text-foreground bg-accent'
					: 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
			)}
		>
			{label}
		</Link>
	);
}

export default function NavBar() {
	return (
		<header className="flex h-11 shrink-0 items-center border-b border-border px-4 gap-6">
			<span className="text-sm font-semibold tracking-wide select-none">MusicBench</span>
			<nav className="flex gap-1">
				{NAV_ITEMS.map(({ to, label }) => (
					<NavLink key={to} to={to} label={label} />
				))}
			</nav>
		</header>
	);
}
