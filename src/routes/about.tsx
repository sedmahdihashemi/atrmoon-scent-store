import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
export const Route = createFileRoute("/about")({ component: () => (
  <PublicLayout>
    <article className="container mx-auto px-4 py-16 max-w-2xl">
      <h1 className="font-serif text-4xl text-ink mb-6 text-center">درباره عطرمون</h1>
      <div className="paper-card rounded-md p-10 leading-loose text-ink/85 space-y-4 font-serif">
        <p>عطرمون پاساژی‌ست از عطرفروشان مستقل ایرانی. اینجا شتاب نداریم؛ هر دفتر، رایحه‌ای دارد و هر رایحه، خاطره‌ای.</p>
        <p>ما باور داریم خریدنِ یک عطر، صرفاً معامله نیست؛ پرسه‌ای‌ست در میان نام‌ها، حجم‌ها، و بطری‌ها. شما حجم را برمی‌گزینید، بطری را، و آن‌گاه فروشنده با شما تماس می‌گیرد.</p>
      </div>
    </article>
  </PublicLayout>
)});