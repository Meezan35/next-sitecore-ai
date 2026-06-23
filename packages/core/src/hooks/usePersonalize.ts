"use client";

import { useEffect, useState } from "react";

export type ContentVariant = {
  itemPath: string;
  segmentName: string;
  content?: Record<string, string>;
};

export type UsePersonalizeOptions = {
  apiRoute?: string;
  fallbackIndex?: number;
};

export type UsePersonalizeReturn = {
  variant: ContentVariant | null;
  segment: string | null;
  isLoading: boolean;
  error: Error | undefined;
};

interface PersonalizeResponse {
  variant: ContentVariant;
  segment: string;
}

/**
 * Resolves a personalized content variant for a guest based on audience segments.
 */
export function usePersonalize(
  guestId: string,
  variants: ContentVariant[],
  options?: UsePersonalizeOptions,
): UsePersonalizeReturn {
  const apiRoute = options?.apiRoute ?? "/api/ai/personalize";
  const fallbackIndex = options?.fallbackIndex ?? 0;

  const [variant, setVariant] = useState<ContentVariant | null>(null);
  const [segment, setSegment] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    let cancelled = false;

    const resolveVariant = async () => {
      setIsLoading(true);
      setError(undefined);

      try {
        const response = await fetch(apiRoute, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guestId, variants }),
        });

        if (!response.ok) {
          throw new Error(
            `Personalize request failed (${response.status} ${response.statusText})`,
          );
        }

        const data = (await response.json()) as PersonalizeResponse;

        if (!cancelled) {
          setVariant(data.variant);
          setSegment(data.segment);
        }
      } catch (err) {
        const personalizeError =
          err instanceof Error ? err : new Error(String(err));
        const fallback = variants[fallbackIndex] ?? null;

        if (!cancelled) {
          setError(personalizeError);
          setVariant(fallback);
          setSegment(fallback?.segmentName ?? null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void resolveVariant();

    return () => {
      cancelled = true;
    };
  }, [apiRoute, guestId, variants, fallbackIndex]);

  return { variant, segment, isLoading, error };
}
