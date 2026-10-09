"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { clearClientToken, getClientToken } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth-server";

const USER_KEY = ["auth", "user"] as const;

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();

  // El token vive en una cookie legible por JS, así que en SSR no hay usuario.
  // Para que el PRIMER render del cliente coincida con el del servidor (y evitar
  // errores de hidratación cuando React Query ya tiene el usuario en caché),
  // no exponemos datos de auth hasta haber montado en el cliente.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const query = useQuery<AuthUser | null>({
    queryKey: USER_KEY,
    queryFn: async () => {
      if (!getClientToken()) return null;
      try {
        const { data } = await apiClient.get<AuthUser>("/user");
        return data;
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });

  const logout = async () => {
    try {
      await apiClient.post("/logout");
    } catch {
      /* ignora errores de red — limpiamos local de todos modos */
    }
    clearClientToken();
    queryClient.setQueryData(USER_KEY, null);
    queryClient.invalidateQueries();
    router.push("/");
    router.refresh();
  };

  // Hasta montar, exponemos "sin usuario / cargando" para igualar el SSR.
  const user = mounted ? query.data ?? null : null;

  return {
    user,
    isLoading: !mounted || query.isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.is_admin ?? false,
    isSuperAdmin: user?.is_super_admin ?? false,
    isModerator: user?.is_moderator ?? false,
    isCreator: user?.is_creator ?? false,
    logout,
    refetch: query.refetch,
  };
}
