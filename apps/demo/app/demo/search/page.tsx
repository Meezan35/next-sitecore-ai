'use client';

import { useState } from 'react';
import { useSearchEnhance, type SearchResult } from 'next-sitecore-ai/client';

function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function ResultList({
  title,
  results,
  emptyMessage,
}: {
  title: string;
  results: SearchResult[];
  emptyMessage: string;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-medium">{title}</h2>
      {results.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">{emptyMessage}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {results.map((result) => (
            <li
              key={result.id}
              className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{result.title}</p>
                <span className="shrink-0 text-xs text-zinc-500">
                  {formatScore(result.score)}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {result.description}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function SearchDemoPage() {
  const [input, setInput] = useState('');
  const { results, originalResults, search, isLoading, error, query } =
    useSearchEnhance();

  const handleSearch = () => {
    const trimmed = input.trim();

    if (!trimmed) {
      return;
    }

    void search(trimmed);
  };

  const hasSearched = query.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Semantic Search</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Compare mock baseline results with AI-enhanced semantic matches.
      </p>

      <div className="mt-8 flex gap-2">
        <input
          type="search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleSearch();
            }
          }}
          placeholder="Search ingested content…"
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={isLoading || !input.trim()}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Search
        </button>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-zinc-500">Searching…</p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error.message}
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <ResultList
          title="Original Results"
          results={originalResults}
          emptyMessage={
            hasSearched ? 'No original results returned.' : 'Run a search to compare results.'
          }
        />
        <ResultList
          title="Re-ranked Results"
          results={results}
          emptyMessage={
            hasSearched ? 'No re-ranked results returned.' : 'Run a search to compare results.'
          }
        />
      </div>
    </main>
  );
}
