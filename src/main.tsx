import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './boot.css';
import './login-fix.css';
import './schedule-card-layout.css';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { logAppError } from './lib/errorLogging';

window.addEventListener('error',event=>void logAppError(event.error||event.message,'window-error'));
window.addEventListener('unhandledrejection',event=>void logAppError(event.reason,'unhandled-promise'));

createRoot(document.getElementById('root')!).render(<AppErrorBoundary><App /></AppErrorBoundary>);
