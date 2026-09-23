import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  let refreshing = false;
  const checkForUpdate=()=>navigator.serviceWorker.getRegistration().then(registration=>registration?.update()).catch(()=>{});
  window.addEventListener('focus',checkForUpdate);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkForUpdate()});
  checkForUpdate();
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !navigator.serviceWorker.controller) return;
    refreshing = true;
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <App />,
);
