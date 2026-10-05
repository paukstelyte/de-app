import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { FlashcardsProvider } from "@/lib/flashcards/context";
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

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DE-app — German grammar practice",
  description:
    "Practise German grammar, A1–B2, and learn from your own mistakes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col text-zinc-900 dark:text-zinc-50">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ThemeProvider>
          <FlashcardsProvider>
            <NavBar auth={<AuthButton />} />
            <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8 sm:py-12 print:max-w-none print:p-0">
              {children}
            </main>
          </FlashcardsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
