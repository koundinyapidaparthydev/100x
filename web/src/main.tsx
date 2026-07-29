import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { applyDemoSessionToApi, readDemoSession } from './lib/session';
import App from './App.tsx';
import './index.css';

applyDemoSessionToApi(readDemoSession());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
