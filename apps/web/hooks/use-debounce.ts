"use client";

import { useEffect, useState } from "react";

/**
 * Devuelve un valor que solo cambia tras `delay`ms sin updates.
 * Útil para evitar disparar fetch en cada tecla.
 */
export function useDebounce<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
