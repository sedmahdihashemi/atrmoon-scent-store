import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { SellerShell } from "@/components/seller/SellerShell";

export const Route = createFileRoute("/seller")({ component: SellerLayout });

function SellerLayout() {
  const matches = useMatches();
  // /seller/pending is a separate flow shown without the gated shell
  if (matches.some((m) => m.routeId === "/seller/pending")) return <Outlet />;
  return (
    <PublicLayout>
      <RoleGuard allow={["seller"]} requireApprovedStore>
        <SellerShell>
          <Outlet />
        </SellerShell>
      </RoleGuard>
    </PublicLayout>
  );
}