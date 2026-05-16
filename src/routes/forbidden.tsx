import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/forbidden")({ component: () => (
  <PublicLayout>
    <div className="container mx-auto px-4 py-24 max-w-md text-center">
      <div className="paper-card rounded-md p-10">
        <h1 className="font-serif text-3xl text-ink mb-3">دسترسی غیرمجاز</h1>
        <p className="text-muted-foreground font-serif italic">این بخش برای نقش شما در دسترس نیست.</p>
        <Link to="/" className="inline-block mt-6"><Button>بازگشت به خانه</Button></Link>
      </div>
    </div>
  </PublicLayout>
)});