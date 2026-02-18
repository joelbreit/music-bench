import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useParams } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { cn } from '@/lib/utils';
import { db } from '@/db';
import type { EvalStrategy, Plan } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PARSE_CODE = `// function assert(output: string): boolean
function assert(output) {
\treturn true;
}`;

// Limit editor viewport height; horizontally always wraps.
const cmHeightTheme = EditorView.theme({
	'&': { maxHeight: '20rem' },
	'.cm-scroller': { overflow: 'auto' },
});

// ─── Sandbox ─────────────────────────────────────────────────────────────────
// Uses new Function — creates an isolated function scope but retains access to
// global scope (window, etc.). Acceptable for a single-admin personal tool
// where the user writes their own assertion code.

function runAssertion(code: string, output: string): { pass: boolean; error?: string } {
	try {
		const fn = new Function(
			'output',
			`${code}\nreturn typeof assert === 'function' ? assert(output) : false;`,
		);
		const result = fn(output);
		return { pass: Boolean(result) };
	} catch (e) {
		return { pass: false, error: e instanceof Error ? e.message : String(e) };
	}
}

// ─── CodeMirror editor wrapper ────────────────────────────────────────────────

function CodeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	// Capture initial value at mount (PlanEditor uses key={plan.id} so remounts per plan).
	const initialValueRef = useRef(value);
	// Keep onChange ref current after every render so the listener always has the latest callback.
	const onChangeRef = useRef(onChange);
	useLayoutEffect(() => {
		onChangeRef.current = onChange;
	});

	// Mount CodeMirror on first render, destroy on unmount.
	// Empty deps is intentional — we rely on key={plan.id} remounting for new plans.
	useEffect(() => {
		if (!containerRef.current) return;
		const view = new EditorView({
			doc: initialValueRef.current,
			extensions: [
				basicSetup,
				javascript(),
				oneDark,
				cmHeightTheme,
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						onChangeRef.current(update.state.doc.toString());
					}
				}),
			],
			parent: containerRef.current,
		});
		viewRef.current = view;
		return () => {
			view.destroy();
			viewRef.current = null;
		};
	}, []);

	return (
		<div
			ref={containerRef}
			className="rounded-md overflow-hidden border border-input text-sm"
		/>
	);
}

// ─── Parse code section (T8) ──────────────────────────────────────────────────

function ParseCodeSection({
	parseCode,
	onCodeChange,
}: {
	parseCode: string;
	onCodeChange: (v: string) => void;
}) {
	const [sampleOutput, setSampleOutput] = useState('');
	const [testResult, setTestResult] = useState<{ pass: boolean; error?: string } | null>(null);
	const [syntaxError, setSyntaxError] = useState<string | null>(null);

	// Debounced syntax check — calls setSyntaxError inside a timeout so it
	// does not count as a synchronous setState-in-effect.
	useEffect(() => {
		const timer = setTimeout(() => {
			try {
				new Function(
					'output',
					`${parseCode}\nreturn typeof assert === 'function' ? assert(output) : false;`,
				);
				setSyntaxError(null);
			} catch (e) {
				setSyntaxError(e instanceof Error ? e.message : String(e));
			}
		}, 400);
		return () => clearTimeout(timer);
	}, [parseCode]);

	function test() {
		console.log('[BuildPlanPage] Running assert test on sample output');
		const result = runAssertion(parseCode, sampleOutput);
		setTestResult(result);
	}

	return (
		<div className="space-y-4">
			<CodeEditor value={parseCode} onChange={onCodeChange} />

			{syntaxError && (
				<p className="text-xs text-error font-mono bg-error/10 px-3 py-2 rounded-md">
					{syntaxError}
				</p>
			)}

			{/* Sample output textarea */}
			<div className="space-y-1.5">
				<p className="text-xs text-muted-foreground">Sample output to test against</p>
				<textarea
					value={sampleOutput}
					onChange={(e) => setSampleOutput(e.target.value)}
					rows={5}
					spellCheck={false}
					placeholder="Paste a sample LLM output here, then click Test…"
					className="w-full rounded-md border border-input bg-background p-3 font-mono text-sm text-foreground resize-none outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
				/>
			</div>

			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={test}
					disabled={!!syntaxError}
					className="px-3 py-1.5 text-xs rounded-md border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-default transition-colors"
				>
					Test
				</button>
				{testResult !== null && (
					<span
						className={cn(
							'text-xs font-medium',
							testResult.pass ? 'text-success' : 'text-error',
						)}
					>
						{testResult.pass
							? '✓ Pass'
							: `✗ Fail${testResult.error ? ` — ${testResult.error}` : ''}`}
					</span>
				)}
			</div>
		</div>
	);
}

// ─── Template editor with {{input}} highlighting ───────────────────────────────

function TemplateEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
	const backdropRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	function syncScroll() {
		if (backdropRef.current && textareaRef.current) {
			backdropRef.current.scrollTop = textareaRef.current.scrollTop;
		}
	}

	function highlight(text: string) {
		return text.split(/({{input}})/g).map((part, i) =>
			part === '{{input}}' ? (
				<mark key={i} className="bg-primary/25 text-transparent rounded-[2px]">
					{part}
				</mark>
			) : (
				<span key={i}>{part}</span>
			),
		);
	}

	return (
		<div className="relative rounded-md border border-input bg-background overflow-hidden focus-within:ring-1 focus-within:ring-ring">
			<div
				ref={backdropRef}
				aria-hidden
				className="absolute inset-0 p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap wrap-break-word overflow-hidden pointer-events-none select-none text-transparent"
			>
				{highlight(value)}
				{'\n'}
			</div>
			<textarea
				ref={textareaRef}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onScroll={syncScroll}
				rows={7}
				spellCheck={false}
				placeholder="Enter prompt template… use {{input}} for the variable part"
				className="relative w-full bg-transparent p-3 font-mono text-sm leading-relaxed text-foreground caret-foreground outline-none resize-none"
			/>
		</div>
	);
}

// ─── Eval strategy segmented control ──────────────────────────────────────────

const STRATEGIES: { value: EvalStrategy; label: string }[] = [
	{ value: 'parse', label: 'Parse' },
	{ value: 'rate', label: 'Rate' },
	{ value: 'compare', label: 'Compare' },
];

function StrategySelector({
	value,
	onChange,
}: {
	value: EvalStrategy;
	onChange: (v: EvalStrategy) => void;
}) {
	return (
		<div className="inline-flex rounded-md border border-input bg-muted p-0.5 gap-0.5">
			{STRATEGIES.map((s) => (
				<button
					key={s.value}
					type="button"
					onClick={() => onChange(s.value)}
					className={cn(
						'px-3 py-1 text-xs rounded transition-colors duration-150',
						value === s.value
							? 'bg-background text-foreground shadow-sm'
							: 'text-muted-foreground hover:text-foreground',
					)}
				>
					{s.label}
				</button>
			))}
		</div>
	);
}

// ─── Plan editor ──────────────────────────────────────────────────────────────
// Receives the plan as an initial prop. Uses key={plan.id} in the parent so
// this component remounts (resetting all state) whenever the plan changes.

function PlanEditor({ plan }: { plan: Plan }) {
	const planId = plan.id;

	const [name, setName] = useState(plan.name);
	const [strategy, setStrategy] = useState<EvalStrategy>(plan.evalStrategy);
	const [template, setTemplate] = useState(plan.promptTemplate);
	const [inputs, setInputs] = useState<string[]>([...plan.inputs]);
	// parseCode is always a string in local state; null is only stored in Dexie
	// when strategy !== 'parse'. Initialized to the default template if null.
	const [parseCode, setParseCode] = useState<string>(
		plan.parseCode ?? DEFAULT_PARSE_CODE,
	);
	const [isDirty, setIsDirty] = useState(false);

	const [editingIdx, setEditingIdx] = useState<number | null>(null);
	const [editingVal, setEditingVal] = useState('');
	const editingInputRef = useRef<HTMLInputElement>(null);

	// ── Focus editing input after render ─────────────────────────────────────

	useEffect(() => {
		if (editingIdx !== null) {
			editingInputRef.current?.focus();
			editingInputRef.current?.select();
		}
	}, [editingIdx]);

	// ── Auto-save with 1.5 s debounce ────────────────────────────────────────

	const save = useCallback(async () => {
		console.log('[BuildPlanPage] Saving plan:', planId);
		await db.plans.update(planId, {
			name,
			evalStrategy: strategy,
			promptTemplate: template,
			inputs,
			parseCode: strategy === 'parse' ? parseCode : null,
			updatedAt: new Date(),
		});
		setIsDirty(false);
	}, [planId, name, strategy, template, inputs, parseCode]);

	useEffect(() => {
		if (!isDirty) return;
		const timer = setTimeout(save, 1500);
		return () => clearTimeout(timer);
	}, [isDirty, save]);

	// ── Field change helpers ──────────────────────────────────────────────────

	function changeName(v: string) {
		setName(v);
		setIsDirty(true);
	}

	function changeTemplate(v: string) {
		setTemplate(v);
		setIsDirty(true);
	}

	function changeStrategy(v: EvalStrategy) {
		if (v === strategy) return;
		// Only confirm if the user has written custom (non-default) parse code
		if (strategy === 'parse' && parseCode !== DEFAULT_PARSE_CODE) {
			if (!window.confirm('Changing strategy will clear the parse code. Continue?')) return;
			setParseCode(DEFAULT_PARSE_CODE);
		}
		console.log('[BuildPlanPage] Changing strategy to:', v);
		setStrategy(v);
		setIsDirty(true);
	}

	function handleCodeChange(v: string) {
		setParseCode(v);
		setIsDirty(true);
	}

	// ── Input list operations ─────────────────────────────────────────────────

	function startEditInput(idx: number) {
		setEditingIdx(idx);
		setEditingVal(inputs[idx]);
	}

	function commitEditInput() {
		if (editingIdx === null) return;
		const trimmed = editingVal.trim();
		const next = [...inputs];
		if (trimmed) {
			next[editingIdx] = trimmed;
		} else {
			next.splice(editingIdx, 1);
		}
		setInputs(next);
		setIsDirty(true);
		setEditingIdx(null);
	}

	function cancelEditInput() {
		if (editingIdx !== null && inputs[editingIdx] === '') {
			setInputs((prev) => prev.filter((_, i) => i !== editingIdx));
		}
		setEditingIdx(null);
	}

	function addInput() {
		console.log('[BuildPlanPage] Adding input');
		const newIdx = inputs.length;
		setInputs((prev) => [...prev, '']);
		setIsDirty(true);
		setEditingIdx(newIdx);
		setEditingVal('');
	}

	function deleteInput(idx: number) {
		console.log('[BuildPlanPage] Deleting input at index:', idx);
		setInputs((prev) => prev.filter((_, i) => i !== idx));
		setIsDirty(true);
		if (editingIdx === idx) setEditingIdx(null);
	}

	function moveInput(idx: number, dir: -1 | 1) {
		const swap = idx + dir;
		if (swap < 0 || swap >= inputs.length) return;
		const next = [...inputs];
		[next[idx], next[swap]] = [next[swap], next[idx]];
		setInputs(next);
		setIsDirty(true);
	}

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<div className="flex flex-col flex-1 overflow-y-auto">
			<div className="max-w-2xl w-full mx-auto px-8 py-8 space-y-8">

				{/* ── Name + save bar ── */}
				<div className="flex items-start gap-4">
					<input
						value={name}
						onChange={(e) => changeName(e.target.value)}
						placeholder="Plan name"
						className="flex-1 text-2xl font-semibold bg-transparent outline-none text-foreground placeholder:text-muted-foreground border-b border-transparent focus:border-border transition-colors pb-0.5"
					/>
					<div className="flex items-center gap-2 shrink-0 pt-1.5">
						{isDirty && (
							<span className="text-xs text-muted-foreground">Unsaved</span>
						)}
						<button
							type="button"
							onClick={save}
							disabled={!isDirty}
							className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 disabled:cursor-default transition-colors"
						>
							Save
						</button>
					</div>
				</div>

				{/* ── Eval strategy ── */}
				<div className="space-y-2">
					<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
						Eval strategy
					</p>
					<StrategySelector value={strategy} onChange={changeStrategy} />
				</div>

				{/* ── Prompt template ── */}
				<div className="space-y-2">
					<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
						Prompt template
					</p>
					<TemplateEditor value={template} onChange={changeTemplate} />
					<p className="text-[11px] text-dim-foreground">
						Use{' '}
						<code className="bg-muted px-1 py-0.5 rounded text-primary font-mono">
							{'{{input}}'}
						</code>{' '}
						where each test input should be interpolated.
					</p>
				</div>

				{/* ── Inputs ── */}
				<div className="space-y-2">
					<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
						Inputs{' '}
						<span className="text-dim-foreground normal-case font-normal">
							({inputs.length})
						</span>
					</p>

					{inputs.length === 0 && (
						<p className="text-xs text-dim-foreground py-1">
							No inputs yet — add one below.
						</p>
					)}

					{inputs.length > 0 && (
						<div className="space-y-0.5">
							{inputs.map((input, idx) => (
								<div
									key={idx}
									className="group flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted transition-colors"
								>
									<div className="flex flex-col shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
										<button
											type="button"
											onClick={() => moveInput(idx, -1)}
											disabled={idx === 0}
											aria-label="Move up"
											className="text-dim-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-default"
										>
											<ChevronUp size={11} />
										</button>
										<button
											type="button"
											onClick={() => moveInput(idx, 1)}
											disabled={idx === inputs.length - 1}
											aria-label="Move down"
											className="text-dim-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-default"
										>
											<ChevronDown size={11} />
										</button>
									</div>

									<span className="shrink-0 w-5 text-right text-[11px] text-dim-foreground tabular-nums">
										{idx + 1}.
									</span>

									{editingIdx === idx ? (
										<input
											ref={editingInputRef}
											value={editingVal}
											onChange={(e) => setEditingVal(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === 'Enter') commitEditInput();
												if (e.key === 'Escape') cancelEditInput();
											}}
											onBlur={commitEditInput}
											className="flex-1 bg-transparent text-sm text-foreground outline-none border-b border-primary"
										/>
									) : (
										<button
											type="button"
											onClick={() => startEditInput(idx)}
											className="flex-1 text-left text-sm text-foreground truncate"
										>
											{input || (
												<span className="text-muted-foreground italic">empty</span>
											)}
										</button>
									)}

									<button
										type="button"
										onClick={() => deleteInput(idx)}
										aria-label="Delete input"
										className="shrink-0 opacity-0 group-hover:opacity-100 text-dim-foreground hover:text-error transition-all"
									>
										<Trash2 size={13} />
									</button>
								</div>
							))}
						</div>
					)}

					<button
						type="button"
						onClick={addInput}
						className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
					>
						<Plus size={12} />
						Add input
					</button>
				</div>

				{/* ── Parse code editor (T8) ── */}
				{strategy === 'parse' && (
					<div className="space-y-2">
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
							Assert function
						</p>
						<ParseCodeSection parseCode={parseCode} onCodeChange={handleCodeChange} />
					</div>
				)}

			</div>
		</div>
	);
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function BuildPlanPage() {
	const { planId } = useParams({ from: '/build/plan/$planId' });
	const plan = useLiveQuery(() => db.plans.get(planId), [planId]);

	if (!plan) {
		return (
			<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
				Loading…
			</div>
		);
	}

	return <PlanEditor key={plan.id} plan={plan} />;
}
