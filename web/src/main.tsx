import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { setApiActor } from '@shared/api';
import App from './App.tsx';
import './index.css';

try {
  const raw = localStorage.getItem('oh-demo-actor');
  if (raw) {
    const parsed = JSON.parse(raw) as { id?: string; surface?: 'web' | 'mobile' };
    if (parsed.id) setApiActor(parsed.id, parsed.surface ?? 'web');
  }
} catch {
  /* ignore corrupt demo session */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
