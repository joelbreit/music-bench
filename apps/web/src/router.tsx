import {
	createRouter,
	createRoute,
	createRootRoute,
	Outlet,
	redirect,
} from '@tanstack/react-router';
import NavBar from '@/components/layout/NavBar';
import BuildPage from '@/pages/BuildPage';
import BuildPlanPage from '@/pages/BuildPlanPage';
import RunPage from '@/pages/RunPage';
import EvaluatePage from '@/pages/EvaluatePage';
import EvaluateRunPage from '@/pages/EvaluateRunPage';
import ExplorePage from '@/pages/ExplorePage';
import ExploreRunPage from '@/pages/ExploreRunPage';
import NotFoundPage from '@/pages/NotFoundPage';
import BuildIndexPage from '@/pages/BuildIndexPage';
import EvaluateIndexPage from '@/pages/EvaluateIndexPage';
import ExploreIndexPage from '@/pages/ExploreIndexPage';

// ─── Root layout ──────────────────────────────────────────────────────────────

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

// ─── Top-level surface routes ─────────────────────────────────────────────────

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

// ─── Build nested routes ───────────────────────────────────────────────────────

const buildIndexRoute = createRoute({
	getParentRoute: () => buildRoute,
	path: '/',
	component: BuildIndexPage,
});

const buildPlanRoute = createRoute({
	getParentRoute: () => buildRoute,
	path: '/plan/$planId',
	component: BuildPlanPage,
});

// ─── Evaluate nested routes ────────────────────────────────────────────────────

const evaluateIndexRoute = createRoute({
	getParentRoute: () => evaluateRoute,
	path: '/',
	component: EvaluateIndexPage,
});

const evaluateRunRoute = createRoute({
	getParentRoute: () => evaluateRoute,
	path: '/$runId',
	component: EvaluateRunPage,
});

// ─── Explore nested routes ─────────────────────────────────────────────────────

const exploreIndexRoute = createRoute({
	getParentRoute: () => exploreRoute,
	path: '/',
	component: ExploreIndexPage,
});

const exploreRunRoute = createRoute({
	getParentRoute: () => exploreRoute,
	path: '/$runId',
	component: ExploreRunPage,
});

// ─── Route tree ────────────────────────────────────────────────────────────────

const routeTree = rootRoute.addChildren([
	indexRoute,
	buildRoute.addChildren([buildIndexRoute, buildPlanRoute]),
	runRoute,
	evaluateRoute.addChildren([evaluateIndexRoute, evaluateRunRoute]),
	exploreRoute.addChildren([exploreIndexRoute, exploreRunRoute]),
]);

export const router = createRouter({
	routeTree,
	defaultNotFoundComponent: NotFoundPage,
});

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
}
