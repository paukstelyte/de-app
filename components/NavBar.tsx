"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

const LINKS = [
  { href: "/learning", label: "Customized Learning", also: [] as string[] },
  // der·die·das (/articles) and The Rules (/rules) are part of the Noun gender topic.
  { href: "/topics", label: "Grammar Topics", also: ["/articles", "/rules"] },
];

export function NavBar({ auth }: { auth: ReactNode }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--line)] bg-[var(--paper)] print:hidden">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-4 sm:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2 font-semibold tracking-tight text-zinc-950 dark:text-zinc-100"
        >
          <span className="flex h-7 w-7 items-center justify-center bg-[var(--accent)] text-xs font-bold text-zinc-950 transition-transform group-hover:-rotate-6">DE</span>
          <span className="hidden sm:inline">DE-app</span>
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-x-1 gap-y-2 sm:gap-3">
          <ul className="flex items-center gap-1">
            {LINKS.map((link) => {
              const isActive = [link.href, ...link.also].some((p) => pathname.startsWith(p));
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm sm:px-3 font-medium transition-colors ${
                      isActive
                        ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "text-zinc-600 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          {auth}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
