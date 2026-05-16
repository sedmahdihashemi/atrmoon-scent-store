import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Moon } from "lucide-react";

export const Route = createFileRoute("/seller/pending")({ component: () => (
  <PublicLayout>
    <RoleGuard allow={["seller"]}>
      <PendingScreen />
    </RoleGuard>
  </PublicLayout>
)});

function PendingScreen() {
  const { storeStatus } = useAuth();
  const isRejected = storeStatus === "rejected";
  const isDisabled = storeStatus === "disabled";
  const isApproved = storeStatus === "approved";
  return (
    <div className="container mx-auto px-4 py-20 max-w-xl text-center">
      <div className="paper-card rounded-md p-12">
        <Moon className="w-10 h-10 text-[var(--gold)] mx-auto mb-4" />
        <h1 className="font-serif text-3xl text-ink mb-3">
          {isApproved ? "فروشگاه شما تأیید شده است" : isRejected ? "درخواست شما تأیید نشد" : isDisabled ? "فروشگاه شما غیرفعال شده" : "فروشگاه شما در انتظار تأیید است"}
        </h1>
        <p className="text-muted-foreground leading-loose font-serif italic">
          {isApproved ? "اکنون می‌توانید وارد دفتر فروشنده شوید." :
           "تیم عطرمون به‌زودی درخواست شما را بررسی می‌کند. دفتر شما، چون فانوسی، آماده‌ی روشن‌شدن است."}
        </p>
        <div className="mt-6">
          {isApproved
            ? <Link to="/seller"><Button>ورود به دفتر</Button></Link>
            : <Link to="/"><Button variant="outline">بازگشت به خانه</Button></Link>}
        </div>
      </div>
    </div>
  );
}