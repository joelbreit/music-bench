import {
	createRouter,
	createRoute,
	createRootRoute,
	Outlet,
	redirect,
} from '@tanstack/react-router';
import NavBar from '@/components/layout/NavBar';
import BuildPage from '@/pages/BuildPage';
import RunPage from '@/pages/RunPage';
import EvaluatePage from '@/pages/EvaluatePage';
import ExplorePage from '@/pages/ExplorePage';

const rootRoute = createRootRoute({
	component: () => (
		<div className="flex min-h-svh flex-col">
			<NavBar />
			<main className="flex flex-1 overflow-hidden">
				<Outlet />
			</main>
		</div>
	),
});

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/',
	beforeLoad: () => {
		throw redirect({ to: '/build' });
	},
});

const buildRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/build',
	component: BuildPage,
});

const runRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/run',
	component: RunPage,
});

const evaluateRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/evaluate',
	component: EvaluatePage,
});

const exploreRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/explore',
	component: ExplorePage,
});

const routeTree = rootRoute.addChildren([
	indexRoute,
	buildRoute,
	runRoute,
	evaluateRoute,
	exploreRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
}
