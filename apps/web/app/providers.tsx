"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { PresencePing } from "@/components/presence-ping";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Datos se consideran "frescos" 15s → tras eso, refetch en background
            staleTime: 2 * 60 * 1000,
            // Cuando vuelves a la pestaña, refresca → así "se recarga solo"
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
            // Cuando recupera la red
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      <PresencePing />
      {children}
    </QueryClientProvider>
  );
}
