import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './boot.css';
import './login-fix.css';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { logAppError } from './lib/errorLogging';

if ('serviceWorker' in navigator) {
  void Promise.all([
    navigator.serviceWorker.getRegistrations().then(registrations=>Promise.all(registrations.map(registration=>registration.unregister()))),
    caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key))))
  ]).catch(()=>{});
}

window.addEventListener('error',event=>void logAppError(event.error||event.message,'window-error'));
window.addEventListener('unhandledrejection',event=>void logAppError(event.reason,'unhandled-promise'));

createRoot(document.getElementById('root')!).render(<AppErrorBoundary><App /></AppErrorBoundary>);
