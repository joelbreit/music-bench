import type { Plan } from '@/types';

// ─── Wire format ──────────────────────────────────────────────────────────────

interface PlanExportData {
	name: string;
	folder: string;
	promptTemplate: string;
	inputs: string[];
	evalStrategy: Plan['evalStrategy'];
	parseCode: string | null;
}

function toWireFormat(plan: Plan, folderName: string): PlanExportData {
	return {
		name: plan.name,
		folder: folderName,
		promptTemplate: plan.promptTemplate,
		inputs: plan.inputs,
		evalStrategy: plan.evalStrategy,
		parseCode: plan.parseCode,
	};
}

// ─── Download helper ──────────────────────────────────────────────────────────

function triggerDownload(filename: string, data: unknown): void {
	const json = JSON.stringify(data, null, 2);
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

function toSlug(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'plan'
	);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Download a single plan as `<plan-name>.musicbench.json`. */
export function exportSinglePlan(plan: Plan, folderName: string): void {
	console.log('[exportPlan] Exporting single plan:', plan.id);
	triggerDownload(
		`${toSlug(plan.name)}.musicbench.json`,
		toWireFormat(plan, folderName)
	);
}

/** Download all plans in a folder as `<folder-name>.musicbench.json`. */
export function exportFolderPlans(plans: Plan[], folderName: string): void {
	console.log(
		'[exportPlan] Exporting folder:',
		folderName,
		'plans:',
		plans.length
	);
	triggerDownload(
		`${toSlug(folderName)}.musicbench.json`,
		plans.map((p) => toWireFormat(p, folderName))
	);
}
