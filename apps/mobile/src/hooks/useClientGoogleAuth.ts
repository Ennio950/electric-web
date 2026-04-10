import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GoogleAuthProvider, signInWithCredential, signInWithCustomToken, signOut } from 'firebase/auth';
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

import { auth } from '@/src/config/firebase';
import { googleAuthConfig } from '@/src/config/mobileEnv';
import { ApiError, fetchBootstrap, verifyGoogleClientAuth } from '@/src/lib/api';
import { appRoutes, replaceAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';

WebBrowser.maybeCompleteAuthSession();

function getMissingGoogleClientConfigMessage() {
  if (Platform.OS === 'web') {
    return 'Falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID para habilitar Google en web.';
  }

  if (Platform.OS === 'ios') {
    return 'Falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID o EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID para habilitar Google en iOS.';
  }

  return 'Falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID o EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID para habilitar Google en Android.';
}

function describeGoogleAuthError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (isErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.SIGN_IN_CANCELLED:
        return '';
      case statusCodes.IN_PROGRESS:
        return 'Google ya esta abriendo un intento de acceso. Espera un momento.';
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return 'El emulador no tiene Google Play Services listos para iniciar sesion.';
      case statusCodes.SIGN_IN_REQUIRED:
        return 'Google requiere que vuelvas a seleccionar una cuenta.';
      default:
        return error.message || 'No se pudo completar el acceso con Google.';
    }
  }

  const code =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : null;

  switch (code) {
    case 'auth/account-exists-with-different-credential':
      return 'Ese correo ya existe con otro metodo de acceso.';
    case 'auth/credential-already-in-use':
      return 'La cuenta de Google ya esta vinculada a otro usuario.';
    case 'auth/invalid-credential':
      return 'Google devolvio una credencial invalida. Revisa la configuracion OAuth.';
    case 'auth/network-request-failed':
      return 'No se pudo conectar con Firebase durante el acceso con Google.';
    default:
      return error instanceof Error ? error.message : 'No se pudo completar el acceso con Google.';
  }
}

export function useClientGoogleAuth() {
  const setNotice = useSessionStore((state) => state.setNotice);
  const setAuthFlow = useSessionStore((state) => state.setAuthFlow);
  const finishBootstrap = useSessionStore((state) => state.finishBootstrap);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [request, , promptAsync] = Google.useAuthRequest({
    webClientId: googleAuthConfig.webClientId,
    clientId: googleAuthConfig.webClientId,
    selectAccount: true,
  });

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    GoogleSignin.configure({
      scopes: ['profile', 'email'],
      webClientId: googleAuthConfig.webClientId,
      iosClientId: googleAuthConfig.iosClientId,
    });
  }, []);

  const isConfigured = Platform.select({
    web: Boolean(googleAuthConfig.webClientId),
    default: Boolean(googleAuthConfig.webClientId),
  });

  async function finishGoogleBootstrap(googleIdToken: string) {
    const googleCredential = GoogleAuthProvider.credential(googleIdToken);
    const googleSession = await signInWithCredential(auth, googleCredential);
    const firebaseIdToken = await googleSession.user.getIdToken();
    const backendSession = await verifyGoogleClientAuth(firebaseIdToken);
    const clientSession = await signInWithCustomToken(auth, backendSession.customToken);
    const nextBootstrap = await fetchBootstrap(backendSession.token);

    finishBootstrap(clientSession.user, nextBootstrap);
    setNotice(null);
    replaceAppRoute(appRoutes.clientHome);
  }

  async function startNativeGoogleSignIn() {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();

    if (!isSuccessResponse(result)) {
      return;
    }

    const googleIdToken = result.data.idToken;
    if (!googleIdToken) {
      throw new Error('Google no devolvio un idToken valido para Firebase.');
    }

    await finishGoogleBootstrap(googleIdToken);
  }

  async function startWebGoogleSignIn() {
    if (!request) {
      setNotice('Google todavia no esta listo. Intenta otra vez en un momento.');
      return;
    }

    const response = await promptAsync();

    if (response.type !== 'success') {
      if (response.type === 'error') {
        throw new Error(response.error?.message || 'No se pudo abrir Google.');
      }
      return;
    }

    const googleIdToken = response.params?.id_token || response.authentication?.idToken;
    if (!googleIdToken) {
      throw new Error('Google no devolvio un id_token valido para Firebase.');
    }

    await finishGoogleBootstrap(googleIdToken);
  }

  async function startGoogleSignIn() {
    if (isSubmitting) {
      return;
    }

    setNotice(null);

    if (!isConfigured) {
      setNotice(getMissingGoogleClientConfigMessage());
      return;
    }

    setIsSubmitting(true);
    setAuthFlow('client-google');

    try {
      if (Platform.OS === 'web') {
        await startWebGoogleSignIn();
      } else {
        await startNativeGoogleSignIn();
      }
    } catch (error) {
      await GoogleSignin.signOut().catch(() => undefined);
      await signOut(auth).catch(() => undefined);
      const message = describeGoogleAuthError(error);
      if (message) {
        setNotice(message);
      }
    } finally {
      setAuthFlow('idle');
      setIsSubmitting(false);
    }
  }

  return {
    isConfigured,
    isSubmitting,
    startGoogleSignIn,
  };
}
