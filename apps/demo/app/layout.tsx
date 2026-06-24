import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'next-sitecore-ai Demo',
  description: 'Demo app for the next-sitecore-ai toolkit',
};

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/demo/suggest', label: 'Suggest' },
  { href: '/demo/chat', label: 'Chat' },
  { href: '/demo/search', label: 'Search' },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <header className="border-b border-zinc-800 bg-zinc-900">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
            <span className="text-sm font-medium text-zinc-300">next-sitecore-ai</span>
            <div className="flex gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-white hover:text-zinc-300"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
