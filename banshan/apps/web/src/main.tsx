import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { startSession } from './net/session';
import { useAppStore } from './store';
import { player } from './store/player';

useAppStore.getState().setName(player.name, false);
startSession();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
