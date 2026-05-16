import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { LoadingState } from "@/components/ui/loading-state";

export function RoleGuard({
  allow,
  children,
  requireApprovedStore,
}: {
  allow: AppRole[];
  children: ReactNode;
  requireApprovedStore?: boolean;
}) {
  const { user, role, loading, storeStatus, profile } = useAuth();

  if (loading) return <LoadingState />;

  if (!user) {
    return <CenteredCard
      title="ورود لازم است"
      message="برای دسترسی به این بخش ابتدا وارد شوید."
      action={<Link to="/login" className="btn-ink">ورود</Link>}
    />;
  }

  if (profile?.status === "blocked") {
    return <CenteredCard title="دسترسی محدود" message="دسترسی حساب شما محدود شده است." />;
  }

  if (!role || !allow.includes(role)) {
    return <CenteredCard
      title="دسترسی غیرمجاز"
      message="این بخش برای نقش شما در دسترس نیست."
      action={<Link to="/" className="btn-ink">بازگشت به خانه</Link>}
    />;
  }

  if (requireApprovedStore && role === "seller" && storeStatus !== "approved") {
    return <CenteredCard
      title="فروشگاه شما هنوز فعال نیست"
      message={
        storeStatus === "rejected"
          ? "درخواست فروشگاه شما تأیید نشد."
          : storeStatus === "disabled"
          ? "فروشگاه شما غیرفعال شده است."
          : "فروشگاه شما در انتظار تأیید است."
      }
      action={<Link to="/seller/pending" className="btn-ink">مشاهده وضعیت</Link>}
    />;
  }

  return <>{children}</>;
}

function CenteredCard({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="paper-card rounded-md p-10 max-w-md text-center">
        <h2 className="font-serif text-2xl text-ink mb-3">{title}</h2>
        <p className="text-muted-foreground leading-relaxed">{message}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}