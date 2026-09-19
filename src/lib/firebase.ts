import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
const emulated = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true';
if (emulated && !['localhost','127.0.0.1'].includes(location.hostname)) throw new Error('Emulator mode is restricted to localhost.');
const app = initializeApp(emulated ? { projectId: 'demo-securetrack', apiKey: 'demo-key', authDomain: 'localhost' } : firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, { localCache: persistentLocalCache({tabManager:persistentMultipleTabManager()}) }, emulated ? '(default)' : firebaseConfig.firestoreDatabaseId);
if (emulated) { connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true}); connectFirestoreEmulator(db,'127.0.0.1',8080); }

