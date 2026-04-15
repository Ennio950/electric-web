import { Auth, getAuth } from 'firebase/auth';

import { app } from '@/src/config/firebaseApp';

export const auth: Auth = getAuth(app);
