import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { seedIfEmpty } from '@/db/index';

// Apply stored theme before first paint to avoid flash
const stored = localStorage.getItem('music-bench-ui');
const theme = stored ? (JSON.parse(stored)?.state?.theme ?? 'dark') : 'dark';
document.documentElement.classList.toggle('dark', theme === 'dark');

seedIfEmpty().then(() => {
	createRoot(document.getElementById('root')!).render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
});
