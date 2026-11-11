import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/jetbrains-mono';
import './styles/global.css';
import './styles/components.css';
import './styles/views.css';
import { App } from './App.tsx';
import { isTauri } from './vault/tauriFs.ts';
import { isNative } from './vault/capFs.ts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA offline: hanya di web (bukan di dalam Tauri / Capacitor, yang sudah membundel berkasnya)
if ('serviceWorker' in navigator && import.meta.env.PROD && !isTauri() && !isNative() && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('./sw.js').catch(() => undefined); });
}
