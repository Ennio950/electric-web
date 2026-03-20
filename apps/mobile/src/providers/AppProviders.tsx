import { PropsWithChildren, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createMobileQueryClient } from '@/src/lib/queryClient';
import { NotificationRouterProvider } from '@/src/providers/NotificationRouterProvider';
import { PushTokenProvider } from '@/src/providers/PushTokenProvider';
import { SessionBootstrap } from '@/src/providers/SessionBootstrap';
import { WorkflowActivityOverlay } from '@/src/providers/WorkflowActivityOverlay';

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(createMobileQueryClient);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionBootstrap />
        <PushTokenProvider />
        <NotificationRouterProvider />
        <WorkflowActivityOverlay />
        {children}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
