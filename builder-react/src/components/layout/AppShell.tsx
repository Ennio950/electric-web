import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore, useCurrentJob } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

function linkClasses(active: boolean) {
  return cn(
    'rounded-md px-3 py-2 text-sm font-medium transition',
    active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
  );
}

export function AppShell() {
  const navigate = useNavigate();
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  const currentJob = useCurrentJob();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1700px] flex-col gap-3 p-3">
      <header className="rounded-lg border border-border bg-card p-3 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-extrabold">Sistema Universal de Cotizacion</h1>
            <p className="text-sm text-muted-foreground">
              Material Catalog + Recipes + Component Tree · modo asistido y experto.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={mode === 'assistant' ? 'success' : 'warning'}>
              {mode === 'assistant' ? 'Modo asistido' : 'Modo experto'}
            </Badge>
            <Button
              variant="secondary"
              onClick={() => setMode(mode === 'assistant' ? 'expert' : 'assistant')}
            >
              Cambiar a {mode === 'assistant' ? 'experto' : 'asistido'}
            </Button>
            {currentJob ? (
              <Button variant="outline" onClick={() => navigate(`/job/${currentJob.id}/results`)}>
                Calcular ahora
              </Button>
            ) : null}
          </div>
        </div>

        <nav className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          <NavLink to="/" className={({ isActive }) => linkClasses(isActive)} end>
            Dashboard
          </NavLink>
          <NavLink
            to={currentJob ? `/job/${currentJob.id}/builder` : '/'}
            className={({ isActive }) => linkClasses(isActive)}
          >
            Job Builder
          </NavLink>
          <NavLink
            to={currentJob ? `/job/${currentJob.id}/results` : '/'}
            className={({ isActive }) => linkClasses(isActive)}
          >
            Results
          </NavLink>
          <NavLink to="/materials" className={({ isActive }) => linkClasses(isActive)}>
            Materiales
          </NavLink>
          <NavLink to="/recipes" className={({ isActive }) => linkClasses(isActive)}>
            Recetas
          </NavLink>
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

