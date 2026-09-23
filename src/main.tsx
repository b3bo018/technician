import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  const checkForUpdate = () => navigator.serviceWorker.getRegistration().then(registration => registration?.update()).catch(() => {});
  window.addEventListener('focus', checkForUpdate);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(); });
  checkForUpdate();
}

createRoot(document.getElementById('root')!).render(<App />);
