import OpenAI from "openai";
import type { ContentChunk } from "./chunker";

export interface EmbedderConfig {
  openAiApiKey: string;
}

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 200;

type EmbeddedChunk = ContentChunk & { embedding: number[] };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Creates an OpenAI embedder for RAG content chunks.
 */
export function createEmbedder(config: EmbedderConfig) {
  const openai = new OpenAI({ apiKey: config.openAiApiKey });

  async function embedTexts(texts: string[]): Promise<number[][]> {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });

    return response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }

  async function embedChunkWithRetry(chunk: ContentChunk): Promise<number[]> {
    try {
      const [embedding] = await embedTexts([chunk.content]);
      return embedding;
    } catch (firstError: unknown) {
      console.error(
        `Embedding failed for ${chunk.itemPath} / ${chunk.fieldName}, retrying once...`,
        firstError,
      );

      try {
        const [embedding] = await embedTexts([chunk.content]);
        return embedding;
      } catch (retryError: unknown) {
        const message =
          retryError instanceof Error ? retryError.message : String(retryError);
        throw new Error(
          `Embedding failed after retry for ${chunk.itemPath} / ${chunk.fieldName}: ${message}`,
        );
      }
    }
  }

  async function embedBatchWithRetry(batch: ContentChunk[]): Promise<number[][]> {
    try {
      return await embedTexts(batch.map((chunk) => chunk.content));
    } catch (firstError: unknown) {
      console.error("Batch embedding failed, retrying once...", firstError);

      try {
        return await embedTexts(batch.map((chunk) => chunk.content));
      } catch (retryError: unknown) {
        console.error(
          "Batch embedding failed after retry, falling back to per-chunk embedding...",
          retryError,
        );

        return Promise.all(batch.map((chunk) => embedChunkWithRetry(chunk)));
      }
    }
  }

  return {
    /**
     * Generates embeddings for content chunks in rate-limited batches.
     */
    async embedChunks(chunks: ContentChunk[]): Promise<EmbeddedChunk[]> {
      const results: EmbeddedChunk[] = [];

      for (let index = 0; index < chunks.length; index += BATCH_SIZE) {
        if (index > 0) {
          await delay(BATCH_DELAY_MS);
        }

        const batch = chunks.slice(index, index + BATCH_SIZE);
        const embeddings = await embedBatchWithRetry(batch);

        for (let batchIndex = 0; batchIndex < batch.length; batchIndex++) {
          results.push({
            ...batch[batchIndex],
            embedding: embeddings[batchIndex],
          });
        }

        console.log(
          `Embedded ${Math.min(index + BATCH_SIZE, chunks.length)} / ${chunks.length} chunks`,
        );
      }

      return results;
    },
  };
}