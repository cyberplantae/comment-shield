import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Navigation } from "./components/Navigation";

export const metadata: Metadata = {
  title: "Comment Shield",
  description:
    "Reads your comments so you don't have to. Hides what's meant to wound, leaves criticism alone.",
};

/** A shield that's also a speech bubble — what the tool does, in one mark. */
function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.6 7.5 10 4.4-1.4 7.5-5.4 7.5-10v-6L12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="m12 7 1.3 3.2 3.2 1.3-3.2 1.3L12 16l-1.3-3.2-3.2-1.3 3.2-1.3L12 7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <a className="skip-link" href="#main-content">Skip to content</a>
        <header className="site-header">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
            <Link href="/" className="flex items-center gap-2">
              <Mark />
              <span className="display text-lg font-semibold">Comment Shield</span>
            </Link>
            <Navigation desktop={process.env.SHIELD_DESKTOP === "1"} />
          </div>
        </header>

        <div id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">{children}</div>

        <footer className="mx-auto max-w-6xl px-5 pb-10 pt-8 text-xs text-[var(--color-muted)] sm:px-8">
          Comment Shield · Here ends this page, not your power. Your boundaries, your decisions.
        </footer>
      </body>
    </html>
  );
}
