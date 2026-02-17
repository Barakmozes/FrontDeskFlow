"use client";

import React, { useMemo } from "react";
import { Provider, cacheExchange, createClient, fetchExchange } from "urql";

/**
 * Dashboard-scoped urql provider.
 * Required for any component using:
 * - useQuery / useMutation from @urql/next
 * - useClient from urql
 *
 * In urql v4+, missing Provider throws a runtime error.
 */
export default function UrqlProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => {
    return createClient({
      url: "/api/graphql",
      exchanges: [cacheExchange, fetchExchange],
      fetchOptions: () => ({
        // Important if /api/graphql relies on cookies (NextAuth/session)
        credentials: "include",
      }),
    });
  }, []);

  return <Provider value={client}>{children}</Provider>;
}
