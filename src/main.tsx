import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { canAttemptChunkReload, triggerChunkRecoveryReload } from './lib/chunkRecovery';
import './index.css';

console.log("[COLEARN] Main module initialized. Mode:", import.meta.env.MODE);

window.addEventListener('vite:preloadError', (event) => {
  if (canAttemptChunkReload()) {
    event.preventDefault();
    triggerChunkRecoveryReload(true);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

