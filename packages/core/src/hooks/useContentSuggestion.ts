"use client";

import { useCompletion } from "ai/react";
import { useCallback } from "react";

export type UseContentSuggestionOptions = {
  apiRoute?: string;
  onError?: (error: Error) => void;
};

export type UseContentSuggestionReturn = {
  suggestion: string;
  suggest: (fieldName?: string) => void;
  isLoading: boolean;
  error: Error | undefined;
  reset: () => void;
};

/**
 * Streams AI-generated content suggestions for a Sitecore item field.
 */
export function useContentSuggestion(
  itemPath: string,
  options?: UseContentSuggestionOptions,
): UseContentSuggestionReturn {
  const apiRoute = options?.apiRoute ?? "/api/ai/suggest";

  const { completion, complete, isLoading, error, setCompletion } =
    useCompletion({
      api: apiRoute,
      onError: options?.onError,
    });

  const suggest = useCallback(
    (fieldName?: string) => {
      void complete(JSON.stringify({ itemPath, fieldName }));
    },
    [complete, itemPath],
  );

  const reset = useCallback(() => {
    setCompletion("");
  }, [setCompletion]);

  return {
    suggestion: completion,
    suggest,
    isLoading,
    error,
    reset,
  };
}
