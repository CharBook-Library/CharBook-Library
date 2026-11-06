import { Suspense } from "react";
import { RouteLoading } from "@/components/route-loading";
import { PremiumClient } from "./premium-client";

export const metadata = {
  title: "CharBook Premium | CharBook Library",
  description: "Planes Gratis, Premium y Premium Plus para leer mejor y apoyar a tus creadores favoritos.",
};

export default function PremiumPage() {
  return (
    <Suspense fallback={<RouteLoading rows={6} />}>
      <PremiumClient />
    </Suspense>
  );
}
