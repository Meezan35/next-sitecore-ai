"use client";

import { useCallback, useState } from "react";

export type SearchResult = {
  id: string;
  title: string;
  url: string;
  description: string;
  score: number;
};

export type UseSearchEnhanceOptions = {
  apiRoute?: string;
  onError?: (error: Error) => void;
};

export type UseSearchEnhanceReturn = {
  results: SearchResult[];
  originalResults: SearchResult[];
  search: (query: string) => Promise<void>;
  isLoading: boolean;
  error: Error | undefined;
  query: string;
};

interface SearchEnhanceResponse {
  results: SearchResult[];
  originalResults: SearchResult[];
}

/**
 * Enhances Sitecore search results with AI-ranked relevance scoring.
 */
export function useSearchEnhance(
  options?: UseSearchEnhanceOptions,
): UseSearchEnhanceReturn {
  const apiRoute = options?.apiRoute ?? "/api/ai/search";

  const [results, setResults] = useState<SearchResult[]>([]);
  const [originalResults, setOriginalResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [query, setQuery] = useState("");

  const search = useCallback(
    async (searchQuery: string) => {
      setQuery(searchQuery);
      setIsLoading(true);
      setError(undefined);

      try {
        const response = await fetch(apiRoute, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery }),
        });

        if (!response.ok) {
          throw new Error(
            `Search enhance request failed (${response.status} ${response.statusText})`,
          );
        }

        const data = (await response.json()) as SearchEnhanceResponse;
        setResults(data.results);
        setOriginalResults(data.originalResults);
      } catch (err) {
        const searchError =
          err instanceof Error ? err : new Error(String(err));
        setError(searchError);
        options?.onError?.(searchError);
      } finally {
        setIsLoading(false);
      }
    },
    [apiRoute, options?.onError],
  );

  return {
    results,
    originalResults,
    search,
    isLoading,
    error,
    query,
  };
}
