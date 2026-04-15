import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { withCurrentToken } from '@/src/lib/api';

type AuthMutationOptions<TData, TVariables> = {
  mutationFn: (token: string, variables: TVariables) => Promise<TData>;
  invalidateKeys?: string[][];
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  hapticOnSuccess?: boolean;
};

/**
 * Wraps a token-authenticated API call with automatic:
 * - Token injection via withCurrentToken
 * - Query invalidation on success
 * - Haptic feedback on success (optional, default true)
 */
export function useAuthMutation<TData = unknown, TVariables = void>(
  options: AuthMutationOptions<TData, TVariables>,
) {
  const queryClient = useQueryClient();
  const { mutationFn, invalidateKeys, onSuccess, hapticOnSuccess = true } = options;

  return useMutation({
    mutationFn: (variables: TVariables) =>
      withCurrentToken((token) => mutationFn(token, variables)),
    onSuccess: async (data, variables) => {
      if (hapticOnSuccess) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      if (invalidateKeys?.length) {
        await Promise.all(
          invalidateKeys.map((queryKey) =>
            queryClient.invalidateQueries({ queryKey }),
          ),
        );
      }

      await onSuccess?.(data, variables);
    },
  });
}
