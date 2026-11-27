import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DirectionProvider } from "@radix-ui/react-direction";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { Toaster } from "@/components/ui/sonner";
import { InstallButton } from "@/components/InstallButton";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  const err = error as { name?: string; message?: string } | undefined;
  const details = [err?.name, err?.message].filter(Boolean).join(": ") || String(error ?? "");

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground">
          صفحه بالا نیامد
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-7">
          مشکلی پیش آمد. می‌توانید دوباره تلاش کنید یا به خانه برگردید.
        </p>
        {details && (
          <pre dir="ltr" className="mt-4 max-h-40 overflow-auto rounded-md border border-input bg-muted/40 p-3 text-right text-[11px] leading-5 text-muted-foreground whitespace-pre-wrap break-words">
            {details}
          </pre>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            دوباره تلاش کن
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            خانه
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "عطرمون | بازار عطر و رایحه" },
      { name: "description", content: "عطرمون؛ بازار آنلاین عطرفروشان ایرانی. کشف رایحه‌ها، انتخاب حجم و بطری، خرید مستقیم از فروشنده." },
      { name: "author", content: "Atrmoon" },
      { name: "theme-color", content: "#f5efe2" },
      { property: "og:title", content: "عطرمون | بازار عطر و رایحه" },
      { property: "og:description", content: "عطرمون؛ بازار آنلاین عطرفروشان ایرانی. کشف رایحه‌ها، انتخاب حجم و بطری، خرید مستقیم از فروشنده." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "عطرمون | بازار عطر و رایحه" },
      { name: "twitter:description", content: "عطرمون؛ بازار آنلاین عطرفروشان ایرانی. کشف رایحه‌ها، انتخاب حجم و بطری، خرید مستقیم از فروشنده." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d57af083-ea7e-4b25-bdb9-fbcefcb7380c/id-preview-2257e83f--7e6e3cc5-0015-4ea3-8952-8c564bbf3167.lovable.app-1778958264263.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d57af083-ea7e-4b25-bdb9-fbcefcb7380c/id-preview-2257e83f--7e6e3cc5-0015-4ea3-8952-8c564bbf3167.lovable.app-1778958264263.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&family=Gentium+Plus:ital,wght@0,400;0,700;1,400&display=swap",
      },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <DirectionProvider dir="rtl">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CartProvider>
            <Outlet />
            <InstallButton />
            <Toaster position="top-center" richColors />
          </CartProvider>
        </AuthProvider>
      </QueryClientProvider>
    </DirectionProvider>
  );
}
