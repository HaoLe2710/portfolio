import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Page not found | Hao.dev",
  description: "The page you requested could not be found.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 py-20 text-center">
          <p className="mb-4 text-sm font-semibold tracking-[0.22em] text-primary uppercase">
            404 · Page not found
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Trang này không tồn tại.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            The page may have moved or the address may be incorrect. Bạn có thể
            quay lại portfolio bằng một trong hai ngôn ngữ.
          </p>
          <nav
            aria-label="Choose a language and return home"
            className="mt-9 flex flex-wrap justify-center gap-3"
          >
            <Link
              className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              href="/en"
            >
              English home
            </Link>
            <Link
              className="rounded-md border border-border px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              href="/vi"
            >
              Trang chủ tiếng Việt
            </Link>
          </nav>
        </main>
      </body>
    </html>
  );
}
