
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 1, // Data is fresh for 1 minute
      gcTime: 1000 * 60 * 10,   // Cache is kept for 10 minutes
      retry: 1,
      refetchOnWindowFocus: false, // Prevent aggressive refetching in development
    },
  },
});
