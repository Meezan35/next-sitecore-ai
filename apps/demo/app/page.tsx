import Link from 'next/link';

const demos = [
  {
    href: '/demo/suggest',
    title: 'Content Suggestion',
    description:
      'Stream AI-powered copy improvements for a Sitecore item path.',
  },
  {
    href: '/demo/chat',
    title: 'RAG Chat',
    description:
      'Ask questions grounded in ingested Sitecore content with source citations.',
  },
  {
    href: '/demo/search',
    title: 'Semantic Search',
    description:
      'Compare baseline search results with AI-enhanced semantic ranking.',
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl flex-col justify-center px-6 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          next-sitecore-ai
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          An open-source AI toolkit for Sitecore XM Cloud + Next.js
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {demos.map((demo) => (
          <Link
            key={demo.href}
            href={demo.href}
            className="rounded-lg border border-zinc-200 bg-white p-5 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
          >
            <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-50">
              {demo.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {demo.description}
            </p>
            <span className="mt-4 inline-block text-sm font-medium text-blue-600 dark:text-blue-400">
              Open demo →
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
