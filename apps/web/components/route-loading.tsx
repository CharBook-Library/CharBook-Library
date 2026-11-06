import { Skeleton } from "@/components/ui/skeleton";

export function RouteLoading({
  titleWidth = "w-64",
  rows = 6,
}: {
  titleWidth?: string;
  rows?: number;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <div className="space-y-3">
        <Skeleton className={`h-9 ${titleWidth}`} />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
