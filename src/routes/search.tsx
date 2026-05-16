import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { EmptyState } from "@/components/ui/loading-state";
import { Search } from "lucide-react";
export const Route = createFileRoute("/search")({ component: () => (
  <PublicLayout><div className="container mx-auto px-4 py-16">
    <EmptyState title="جستجو در راه است" message="به‌زودی می‌توانید میان همه رایحه‌ها بگردید." icon={<Search className="w-8 h-8" />} />
  </div></PublicLayout>
)});