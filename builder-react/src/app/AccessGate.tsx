import { PropsWithChildren, useEffect, useState } from 'react';
import {
  buildPortalUrl,
  getHostOrigin,
  getReturnToPath,
  hydratePortalSessionFromSearch,
  validatePortalAccess,
  type PortalAccessResult,
} from '@/app/portalAccess';

function explainReason(reason: string) {
  switch (reason) {
    case 'expired':
      return 'Tu sesion del portal expiro. Vuelve a iniciar sesion para entrar al builder.';
    case 'role':
    case 'timestamp':
      return 'No encontramos una sesion valida del portal en este navegador.';
    case 'network':
      return 'No se pudo validar la sesion contra el backend.';
    case 'server_rejected':
      return 'La sesion ya no es valida o ya no tiene permisos para este modulo.';
    case 'server_error':
      return 'El backend respondio con un error inesperado.';
    default:
      return 'Este modulo solo esta disponible despues de iniciar sesion como empleado o jefe.';
  }
}

export function AccessGate({ children }: PropsWithChildren) {
  const [access, setAccess] = useState<PortalAccessResult>({
    allowed: false,
    reason: 'loading',
    role: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (typeof window === 'undefined') {
        if (!cancelled) {
          setAccess({ allowed: false, reason: 'ssr', role: null });
        }
        return;
      }

      const session = hydratePortalSessionFromSearch(window.location.search, window.localStorage);
      const hostOrigin = getHostOrigin(window.location.search, window.location.origin);
      const result = await validatePortalAccess({
        fetchImpl: window.fetch.bind(window),
        hostOrigin,
        session,
        storage: window.localStorage,
      });

      if (!cancelled) {
        setAccess(result);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  if (access.reason === 'loading') {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center p-4">
        <div className="w-full rounded-xl border border-border bg-card p-6 text-card-foreground shadow-card">
          <h1 className="text-xl font-bold">Validando acceso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Espera un momento mientras verificamos tu sesion.
          </p>
        </div>
      </div>
    );
  }

  if (access.allowed) {
    return <>{children}</>;
  }

  const hostOrigin = typeof window === 'undefined'
    ? ''
    : getHostOrigin(window.location.search, window.location.origin);
  const returnTo = typeof window === 'undefined' ? '' : getReturnToPath(window.location.pathname);
  const employeeLogin = buildPortalUrl(hostOrigin, 'login-empleado.html', returnTo);
  const bossLogin = buildPortalUrl(hostOrigin, 'login-jefe.html', returnTo);
  const homeUrl = buildPortalUrl(hostOrigin, 'index.html');

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center p-4">
      <div className="w-full rounded-xl border border-border bg-card p-6 text-card-foreground shadow-card">
        <h1 className="text-xl font-bold">Acceso restringido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {explainReason(access.reason)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Detalle: {access.reason}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            href={employeeLogin}
          >
            Entrar como empleado
          </a>
          <a
            className="inline-flex items-center rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground"
            href={bossLogin}
          >
            Entrar como jefe
          </a>
          <a
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-semibold"
            href={homeUrl}
          >
            Volver al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
