import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';

import { firebaseWebConfig } from '@/src/config/mobileEnv';

export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseWebConfig);
