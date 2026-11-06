import type { Metadata } from "next";
import { StudioSidebar } from "@/components/studio/studio-sidebar";

export const metadata: Metadata = {
  title: "Studio · CharBook",
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="lg:flex">
        <StudioSidebar />
        <main className="min-h-screen flex-1 lg:max-w-[calc(100vw-18rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
