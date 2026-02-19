import { useState, useRef } from 'react';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
	parseResultsJson,
	type RunExportData,
	type ParseResultsResult,
} from '@/lib/importResults';

// ─── Preview ──────────────────────────────────────────────────────────────────

const STRATEGY_LABEL: Record<RunExportData['plan']['evalStrategy'], string> = {
	parse: 'Parse',
	rate: 'Rate',
	compare: 'Compare',
};

function ResultsPreview({ data }: { data: RunExportData }) {
	const judgmentCount =
		data.verdicts.length + data.ratings.length + data.rankings.length;

	return (
		<div>
			<div className="grid grid-cols-[1fr_4.5rem_3.5rem_3.5rem_3.5rem] gap-x-4 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground border-b border-border">
				<span>Plan</span>
				<span>Strategy</span>
				<span>Models</span>
				<span>Trials</span>
				<span>Judgments</span>
			</div>
			<div className="grid grid-cols-[1fr_4.5rem_3.5rem_3.5rem_3.5rem] gap-x-4 px-3 py-1.5 text-xs">
				<span className="truncate font-medium text-foreground">
					{data.plan.name}
				</span>
				<span className="text-muted-foreground">
					{STRATEGY_LABEL[data.plan.evalStrategy]}
				</span>
				<span className="text-muted-foreground tabular-nums">
					{data.models.length}
				</span>
				<span className="text-muted-foreground tabular-nums">
					{data.trials.length}
				</span>
				<span className="text-muted-foreground tabular-nums">
					{judgmentCount}
				</span>
			</div>
		</div>
	);
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: (data: RunExportData) => Promise<void>;
}

export default function ImportResultsDialog({
	open,
	onOpenChange,
	onConfirm,
}: Props) {
	const [tab, setTab] = useState<'file' | 'paste'>('file');
	const [pasteText, setPasteText] = useState('');
	const [result, setResult] = useState<ParseResultsResult | null>(null);
	const [importing, setImporting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	function handleOpenChange(v: boolean) {
		if (!v) {
			setTab('file');
			setPasteText('');
			setResult(null);
			setImporting(false);
			if (fileInputRef.current) fileInputRef.current.value = '';
		}
		onOpenChange(v);
	}

	function switchTab(t: 'file' | 'paste') {
		if (t === tab) return;
		setTab(t);
		setResult(null);
		setPasteText('');
		if (fileInputRef.current) fileInputRef.current.value = '';
	}

	async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		console.log('[ImportResultsDialog] Reading file:', file.name);
		const text = await file.text();
		setResult(parseResultsJson(text));
	}

	function handleParse() {
		console.log('[ImportResultsDialog] Parsing pasted JSON');
		setResult(parseResultsJson(pasteText));
	}

	async function handleConfirm() {
		if (!result?.ok) return;
		console.log('[ImportResultsDialog] Confirming import');
		setImporting(true);
		try {
			await onConfirm(result.data);
			handleOpenChange(false);
		} finally {
			setImporting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Import Results</DialogTitle>
				</DialogHeader>

				{/* ── Tabs ── */}
				<div className="flex border-b border-border -mx-6 px-6">
					{(['file', 'paste'] as const).map((t) => (
						<button
							key={t}
							type="button"
							onClick={() => switchTab(t)}
							className={cn(
								'px-3 pb-2 pt-1 text-xs border-b-2 transition-colors capitalize',
								tab === t
									? 'border-primary text-foreground'
									: 'border-transparent text-muted-foreground hover:text-foreground'
							)}
						>
							{t === 'file' ? 'File' : 'Paste'}
						</button>
					))}
				</div>

				{/* ── Tab body ── */}
				<div className="space-y-4 pt-1">
					{tab === 'file' ? (
						<div className="space-y-1.5">
							<input
								ref={fileInputRef}
								type="file"
								accept=".json,.musicbench-results.json,application/json"
								onChange={handleFileChange}
								className="block w-full text-xs text-muted-foreground file:mr-3 file:px-3 file:py-1 file:rounded file:border file:border-border file:text-xs file:bg-muted file:text-foreground hover:file:bg-muted/70 file:transition-colors cursor-pointer"
							/>
							<p className="text-[11px] text-muted-foreground">
								Accepts{' '}
								<code className="font-mono">
									.musicbench-results.json
								</code>{' '}
								or any <code className="font-mono">.json</code>{' '}
								in the results format.
							</p>
						</div>
					) : (
						<div className="space-y-2">
							<textarea
								value={pasteText}
								onChange={(e) => setPasteText(e.target.value)}
								rows={7}
								spellCheck={false}
								placeholder="Paste results JSON here…"
								className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs text-foreground resize-none outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
							/>
							<button
								type="button"
								onClick={handleParse}
								disabled={!pasteText.trim()}
								className="px-3 py-1.5 text-xs rounded-md border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-default transition-colors"
							>
								Parse JSON
							</button>
						</div>
					)}

					{/* ── Result: errors or preview ── */}
					{result &&
						(result.ok ? (
							<div className="space-y-2">
								<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
									Ready to import
								</p>
								<div className="rounded-md border border-border overflow-hidden">
									<ResultsPreview data={result.data} />
								</div>
							</div>
						) : (
							<div className="rounded-md bg-error/10 border border-error/20 p-3 space-y-1 max-h-40 overflow-y-auto">
								{result.errors.map((e, i) => (
									<p
										key={i}
										className="text-xs text-error font-mono"
									>
										{e}
									</p>
								))}
							</div>
						))}
				</div>

				<DialogFooter showCloseButton>
					<button
						type="button"
						onClick={handleConfirm}
						disabled={!result?.ok || importing}
						className="px-4 py-1.5 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-default hover:bg-primary/90 transition-colors"
					>
						{importing ? 'Importing…' : 'Import'}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
