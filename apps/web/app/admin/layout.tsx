import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth-server";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export const metadata = {
  title: "Panel Admin",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();

  // Protección: admin, super_admin o moderator pueden entrar al panel.
  // (Las pantallas internas filtran granularmente: solo super_admin ve "Sistema",
  // moderator solo ve reports + creator apps, etc.)
  if (!user) redirect("/login?from=/admin");
  if (!user.is_admin && !user.is_moderator) redirect("/?error=not_admin");

  return (
    <div className="grid min-h-[calc(100dvh-4rem)] grid-cols-1 md:grid-cols-[240px_1fr]">
      <AdminSidebar user={user} />
      <div className="flex flex-col overflow-x-hidden bg-muted/20">
        {children}
      </div>
    </div>
  );
}
