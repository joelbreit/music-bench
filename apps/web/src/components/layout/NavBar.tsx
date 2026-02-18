import { useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { Moon, Sun, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';
import ModelRegistryDialog from '@/components/settings/ModelRegistryDialog';

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
					: 'text-muted-foreground hover:text-foreground hover:bg-muted'
			)}
		>
			{label}
		</Link>
	);
}

export default function NavBar() {
	const { theme, toggleTheme } = useUIStore();
	const [settingsOpen, setSettingsOpen] = useState(false);

	return (
		<>
			<header className="flex h-11 shrink-0 items-center border-b border-border px-4 gap-6">
				<span className="text-sm font-semibold tracking-wide select-none">
					MusicBench
				</span>
				<nav className="flex gap-1">
					{NAV_ITEMS.map(({ to, label }) => (
						<NavLink key={to} to={to} label={label} />
					))}
				</nav>
				<div className="ml-auto flex items-center gap-1">
					<button
						onClick={() => {
							console.log('[NavBar] Opening settings');
							setSettingsOpen(true);
						}}
						className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-muted"
						aria-label="Settings"
					>
						<Settings size={14} />
					</button>
					<button
						onClick={toggleTheme}
						className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-muted"
						aria-label="Toggle theme"
					>
						{theme === 'dark' ? (
							<Sun size={14} />
						) : (
							<Moon size={14} />
						)}
					</button>
				</div>
			</header>
			<ModelRegistryDialog
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
			/>
		</>
	);
}
