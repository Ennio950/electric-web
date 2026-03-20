import { Navigate, createHashRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/features/jobs/DashboardPage';
import { JobBuilderPage } from '@/features/jobs/JobBuilderPage';
import { ResultsPage } from '@/features/jobs/ResultsPage';
import { MaterialsPage } from '@/features/materials/MaterialsPage';
import { RecipesPage } from '@/features/recipes/RecipesPage';

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'job/:jobId/builder', element: <JobBuilderPage /> },
      { path: 'job/:jobId/results', element: <ResultsPage /> },
      { path: 'materials', element: <MaterialsPage /> },
      { path: 'recipes', element: <RecipesPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
