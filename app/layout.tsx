import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import { ThemeProvider } from "@/lib/theme/context";
import { THEME_STORAGE_KEY } from "@/lib/theme/constants";
import { NavBar } from "@/components/NavBar";
import { AuthButton } from "@/components/auth-button";
import "./globals.css";

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});


export const metadata: Metadata = {
  title: { default: "DE-app — German grammar practice", template: "%s · DE-app" },
  description:
    "Practise German grammar, A1–B2, and learn from your own mistakes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} h-full antialiased`}
    >
      <head>
        {/* Runs before first paint so the saved theme never flashes. It must live
            in <head>: a <script> inside <body> makes React warn in development. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col text-zinc-900 dark:text-zinc-50">
        <ThemeProvider>
          <NavBar auth={<AuthButton />} />
          <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8 sm:py-12 print:max-w-none print:p-0">
            {children}
          </main>
          <footer className="mx-auto w-full max-w-5xl px-5 pb-8 text-xs text-zinc-500 sm:px-8 print:hidden">
            <Link href="/privacy" className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100">
              Privacy
            </Link>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
