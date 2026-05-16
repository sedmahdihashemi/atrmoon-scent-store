import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
export const Route = createFileRoute("/contact")({ component: () => (
  <PublicLayout>
    <div className="container mx-auto px-4 py-16 max-w-md text-center">
      <div className="paper-card rounded-md p-10">
        <h1 className="font-serif text-3xl text-ink mb-4">گفت‌وگو</h1>
        <p className="text-muted-foreground leading-loose">برای ارتباط با عطرمون: <span dir="ltr" className="text-[var(--gold)]">hello@atrmoon.app</span></p>
      </div>
    </div>
  </PublicLayout>
)});