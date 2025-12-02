"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between border-b border-slate-200/70 bg-slate-50/70 px-4 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-950/70">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
          <Image
            src="/capabala-logo.png"
            alt="Capabala Logo"
            width={120}
            height={40}
            className="h-8 w-auto"
            priority
          />
          <span>RankingLab Tools</span>
        </Link>
        <nav className="flex gap-4">
          <Link
            href="/"
            className={`text-sm transition-colors ${isActive("/")
              ? "font-bold underline text-black dark:text-white"
              : "font-medium text-slate-600 hover:underline dark:text-slate-400"
              }`}
          >
            Slider Reveal
          </Link>
          <Link
            href="/slideshow"
            className={`text-sm transition-colors ${isActive("/slideshow")
              ? "font-bold underline text-black dark:text-white"
              : "font-medium text-slate-600 hover:underline dark:text-slate-400"
              }`}
          >
            Slideshow Generator
          </Link>
        </nav>
      </div>
      <ThemeToggle />
    </header>
  );
}








