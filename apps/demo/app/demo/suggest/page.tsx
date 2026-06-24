'use client';

import { useState } from 'react';
import { useContentSuggestion } from 'next-sitecore-ai/client';

const DEFAULT_ITEM_PATH =
  '/sitecore/content/Sheppard/sheppard/Home/Data/Hero Banner Folder/Hero Banner';

export default function SuggestDemoPage() {
  const [itemPath, setItemPath] = useState(DEFAULT_ITEM_PATH);
  const [fieldName, setFieldName] = useState('');
  const { suggestion, suggest, isLoading, error } = useContentSuggestion(itemPath);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Content Suggestion</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Generate streaming suggestions for Sitecore item content.
      </p>

      <div className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Item path</span>
          <input
            type="text"
            value={itemPath}
            onChange={(event) => setItemPath(event.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Field name (optional)</span>
          <input
            type="text"
            value={fieldName}
            onChange={(event) => setFieldName(event.target.value)}
            placeholder="e.g. Title"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <button
          type="button"
          onClick={() => suggest(fieldName || undefined)}
          disabled={isLoading || !itemPath.trim()}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Generate Suggestions
        </button>
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-zinc-500">Generating suggestions…</p>
      ) : null}

      {error ? (
        <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error.message}
        </p>
      ) : null}

      {suggestion ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Results</h2>
          <pre className="mt-2 overflow-x-auto rounded-md border border-zinc-200 bg-white p-4 text-sm leading-relaxed whitespace-pre-wrap dark:border-zinc-800 dark:bg-zinc-900">
            {suggestion}
          </pre>
        </section>
      ) : null}
    </main>
  );
}
