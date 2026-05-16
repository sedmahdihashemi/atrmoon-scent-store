import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { EmptyState } from "@/components/ui/loading-state";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/cart")({ component: () => (
  <PublicLayout><div className="container mx-auto px-4 py-16">
    <EmptyState title="بقچه رایحه‌های شما هنوز خالی‌ست" message="به دفتر رایحه‌ها برگردید و چیزی برای امشب برگزینید." icon={<ShoppingBag className="w-8 h-8" />} />
    <div className="mt-6 text-center"><Link to="/products"><Button>کشف رایحه‌ها</Button></Link></div>
  </div></PublicLayout>
)});