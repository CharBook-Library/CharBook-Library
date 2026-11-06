"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface SearchContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const SearchContext = createContext<SearchContextValue>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
});

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <SearchContext.Provider
      value={{ open, setOpen, toggle: () => setOpen((o) => !o) }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export const useSearch = () => useContext(SearchContext);
