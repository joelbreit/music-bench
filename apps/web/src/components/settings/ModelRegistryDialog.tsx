import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2, Plus, Eye, EyeOff } from 'lucide-react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { db } from '@/db';
import type { Model, Provider } from '@/types';

// ─── Provider badge ────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<Provider, string> = {
	anthropic: 'Anthropic',
	openai: 'OpenAI',
	other: 'Other',
};

const PROVIDER_COLORS: Record<Provider, string> = {
	anthropic: 'bg-chart-1/15 text-chart-1',
	openai: 'bg-chart-2/15 text-chart-2',
	other: 'bg-muted text-muted-foreground',
};

function ProviderBadge({ provider }: { provider: Provider }) {
	return (
		<span
			className={cn(
				'shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
				PROVIDER_COLORS[provider],
			)}
		>
			{PROVIDER_LABELS[provider]}
		</span>
	);
}

// ─── API key input ─────────────────────────────────────────────────────────────

const API_KEY_STORAGE = 'mb:openrouter-key';

function ApiKeySection() {
	// Lazy initializer reads localStorage once at mount — no effect needed.
	const [apiKey, setApiKey] = useState<string>(
		() => localStorage.getItem(API_KEY_STORAGE) ?? '',
	);
	const [showKey, setShowKey] = useState(false);

	function handleChange(v: string) {
		setApiKey(v);
		localStorage.setItem(API_KEY_STORAGE, v);
	}

	return (
		<div className="space-y-1.5">
			<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
				OpenRouter API key
			</p>
			<div className="flex gap-2">
				<input
					type={showKey ? 'text' : 'password'}
					value={apiKey}
					onChange={(e) => handleChange(e.target.value)}
					placeholder="sk-or-…"
					spellCheck={false}
					className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground font-mono outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
				/>
				<button
					type="button"
					onClick={() => setShowKey((v) => !v)}
					aria-label={showKey ? 'Hide key' : 'Show key'}
					className="flex items-center justify-center w-8 h-8 rounded-md border border-input text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
				>
					{showKey ? <EyeOff size={13} /> : <Eye size={13} />}
				</button>
			</div>
			<p className="text-[11px] text-dim-foreground">
				Stored in localStorage — never sent to any server other than OpenRouter.
			</p>
		</div>
	);
}

// ─── Add model form ────────────────────────────────────────────────────────────

const PROVIDERS: Provider[] = ['anthropic', 'openai', 'other'];

function AddModelForm({ onDone }: { onDone: () => void }) {
	const [name, setName] = useState('');
	const [provider, setProvider] = useState<Provider>('anthropic');
	const [apiBase, setApiBase] = useState('');

	async function submit() {
		const trimmedName = name.trim();
		if (!trimmedName) return;
		const id = crypto.randomUUID();
		console.log('[ModelRegistry] Adding model:', trimmedName, provider);
		await db.models.add({
			id,
			name: trimmedName,
			provider,
			apiBase: apiBase.trim() || null,
			enabled: true,
		});
		onDone();
	}

	return (
		<div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
			<p className="text-xs font-medium text-foreground">Add model</p>

			{/* Name */}
			<div className="space-y-1">
				<label className="text-[11px] text-muted-foreground">
					Model ID
				</label>
				<input
					value={name}
					onChange={(e) => setName(e.target.value)}
					onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
					placeholder="e.g. anthropic/claude-opus-4-6"
					autoFocus
					className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm text-foreground font-mono outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
				/>
			</div>

			{/* Provider */}
			<div className="space-y-1">
				<label className="text-[11px] text-muted-foreground">Provider</label>
				<select
					value={provider}
					onChange={(e) => setProvider(e.target.value as Provider)}
					className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
				>
					{PROVIDERS.map((p) => (
						<option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
					))}
				</select>
			</div>

			{/* API base (optional) */}
			<div className="space-y-1">
				<label className="text-[11px] text-muted-foreground">
					API base URL <span className="text-dim-foreground">(optional — leave blank for OpenRouter)</span>
				</label>
				<input
					value={apiBase}
					onChange={(e) => setApiBase(e.target.value)}
					placeholder="https://api.example.com/v1"
					className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm text-foreground font-mono outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
				/>
			</div>

			{/* Actions */}
			<div className="flex gap-2 pt-1">
				<button
					type="button"
					onClick={submit}
					disabled={!name.trim()}
					className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 disabled:cursor-default transition-colors"
				>
					Add
				</button>
				<button
					type="button"
					onClick={onDone}
					className="px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
				>
					Cancel
				</button>
			</div>
		</div>
	);
}

// ─── Model row ─────────────────────────────────────────────────────────────────

function ModelRow({ model }: { model: Model }) {
	async function toggleEnabled() {
		console.log('[ModelRegistry] Toggling model:', model.id, !model.enabled);
		await db.models.update(model.id, { enabled: !model.enabled });
	}

	async function deleteModel() {
		if (!window.confirm(`Remove model "${model.name}"?`)) return;
		console.log('[ModelRegistry] Deleting model:', model.id);
		await db.models.delete(model.id);
	}

	return (
		<div className="group flex items-center gap-3 py-2 px-1">
			<Switch
				checked={model.enabled}
				onCheckedChange={toggleEnabled}
				aria-label={`Enable ${model.name}`}
			/>
			<span className="flex-1 min-w-0 text-sm text-foreground font-mono truncate">
				{model.name}
			</span>
			<ProviderBadge provider={model.provider} />
			<button
				type="button"
				onClick={deleteModel}
				aria-label={`Delete ${model.name}`}
				className="shrink-0 opacity-0 group-hover:opacity-100 text-dim-foreground hover:text-error transition-all"
			>
				<Trash2 size={13} />
			</button>
		</div>
	);
}

// ─── Main dialog ───────────────────────────────────────────────────────────────

export default function ModelRegistryDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const models = useLiveQuery(() => db.models.toArray()) ?? [];
	const [showAddForm, setShowAddForm] = useState(false);

	const enabled = models.filter((m) => m.enabled);
	const disabled = models.filter((m) => !m.enabled);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Settings</DialogTitle>
				</DialogHeader>

				<div className="space-y-6 pt-2">

					{/* ── API key ── */}
					<ApiKeySection />

					{/* ── Model registry ── */}
					<div className="space-y-1.5">
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
							Models
						</p>

						{models.length === 0 && !showAddForm && (
							<p className="text-xs text-dim-foreground py-2">No models configured.</p>
						)}

						{models.length > 0 && (
							<div className="divide-y divide-border">
								{enabled.map((m) => <ModelRow key={m.id} model={m} />)}
								{disabled.map((m) => <ModelRow key={m.id} model={m} />)}
							</div>
						)}

						{showAddForm ? (
							<AddModelForm onDone={() => setShowAddForm(false)} />
						) : (
							<button
								type="button"
								onClick={() => setShowAddForm(true)}
								className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
							>
								<Plus size={12} />
								Add model
							</button>
						)}
					</div>

				</div>
			</DialogContent>
		</Dialog>
	);
}
