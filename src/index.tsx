import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

/** App is code-split into its own chunk so the entry bundle stays minimal; no routing is involved. */
const App = lazy(() => import('./App'));

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <Suspense fallback={null}><App /></Suspense>
    </React.StrictMode>
  );
}
