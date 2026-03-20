import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { AccessGate } from '@/app/AccessGate';
import { router } from '@/app/router';

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AccessGate>
        <RouterProvider router={router} />
      </AccessGate>
    </QueryClientProvider>
  );
}
