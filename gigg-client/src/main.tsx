import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Automatically clear legacy CacheStorage in development/production
if ('caches' in window) {
  caches.keys().then((names) => {
    names.forEach((name) => caches.delete(name));
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);
