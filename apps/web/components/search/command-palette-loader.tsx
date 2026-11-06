"use client";

import dynamic from "next/dynamic";
import { useSearch } from "./search-context";

const LazyCommandPalette = dynamic(
  () => import("./command-palette").then((module) => module.CommandPalette),
  {
    ssr: false,
    loading: () => null,
  },
);

export function preloadCommandPalette() {
  void import("./command-palette");
}

export function CommandPaletteLoader() {
  const { open } = useSearch();
  if (!open) return null;
  return <LazyCommandPalette />;
}
