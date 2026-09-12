import { QueryClient } from "@tanstack/react-query";

/**
 * A singleton QueryClient used specifically for complaint data. Kept
 * separate from the router's per-request QueryClient (see src/router.tsx)
 * so plain async helpers like createComplaint()/advance() can invalidate
 * the cache without needing access to React context.
 */
export const complaintsQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});
