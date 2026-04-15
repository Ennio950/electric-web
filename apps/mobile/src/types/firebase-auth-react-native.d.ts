import 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(
    storage: unknown,
  ): import('@firebase/auth').Persistence;
}
