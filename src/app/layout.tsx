import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeWatcher } from "../components/theme-toggle";
import { Header } from "../components/header";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RankingLab Tools",
  description: "Create stunning videos with ease",

};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeScript = `(() => {
    const storageKey = 'video-editor-theme';
    const root = document.documentElement;
    const prefersDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    let theme = 'dark';
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'light' || stored === 'dark') {
        theme = stored;
      } else if (prefersDark()) {
        theme = 'dark';
      } else {
        theme = 'light';
      }
    } catch (error) {
      theme = prefersDark() ? 'dark' : 'light';
    }
    root.dataset.theme = theme;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.style.colorScheme = theme;
  })();`;

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeWatcher />
        <div className="flex h-screen flex-col overflow-hidden bg-background transition-colors duration-200">
          <Header />
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
