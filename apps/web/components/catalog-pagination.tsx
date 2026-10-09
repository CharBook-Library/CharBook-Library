import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  lastPage: number;
  /** Función que recibe el número de página y retorna el href. */
  hrefFor: (page: number) => string;
}

export function CatalogPagination({
  currentPage,
  lastPage,
  hrefFor,
}: PaginationProps) {
  if (lastPage <= 1) return null;

  const start = Math.max(1, currentPage - 2);
  const end = Math.min(lastPage, currentPage + 2);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <nav className="mt-10 flex items-center justify-center gap-1.5">
      <PageLink
        href={currentPage > 1 ? hrefFor(currentPage - 1) : undefined}
        ariaLabel="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </PageLink>

      {start > 1 && (
        <>
          <PageLink href={hrefFor(1)}>{1}</PageLink>
          {start > 2 && <span className="px-1 text-muted-foreground">…</span>}
        </>
      )}

      {pages.map((p) => (
        <PageLink key={p} href={hrefFor(p)} active={p === currentPage}>
          {p}
        </PageLink>
      ))}

      {end < lastPage && (
        <>
          {end < lastPage - 1 && (
            <span className="px-1 text-muted-foreground">…</span>
          )}
          <PageLink href={hrefFor(lastPage)}>{lastPage}</PageLink>
        </>
      )}

      <PageLink
        href={currentPage < lastPage ? hrefFor(currentPage + 1) : undefined}
        ariaLabel="Página siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  children,
  href,
  active,
  ariaLabel,
}: {
  children: React.ReactNode;
  href?: string;
  active?: boolean;
  ariaLabel?: string;
}) {
  const cls = cn(
    "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors",
    active
      ? "bg-primary text-primary-foreground"
      : "border border-border/60 text-muted-foreground hover:border-primary/60 hover:text-foreground",
    !href && "pointer-events-none opacity-40"
  );
  if (!href) {
    return (
      <span className={cls} aria-label={ariaLabel}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={cls} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
