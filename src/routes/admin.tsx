import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  return (
    <PublicLayout>
      <RoleGuard allow={["super_admin"]}>
        <AdminShell>
          <Outlet />
        </AdminShell>
      </RoleGuard>
    </PublicLayout>
  );
}
