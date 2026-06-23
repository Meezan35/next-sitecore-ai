import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";
import { streamText } from "ai";
import OpenAI from "openai";

export interface RAGConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  openAiApiKey: string;
  siteName: string;
  matchThreshold?: number;
  matchCount?: number;
}

export interface RAGResult {
  answer: ReadableStream<string>;
  sources: Array<{
    itemPath: string;
    itemName: string;
    fieldName: string;
    content: string;
    similarity: number;
  }>;
}

interface MatchSitecoreContentRow {
  item_path: string;
  item_name: string;
  field_name: string;
  content: string;
  similarity: number;
}

const SYSTEM_PROMPT =
  "You are a helpful assistant that answers questions about website content. Use only the provided context to answer. If the context does not contain the answer, say so clearly.";

const NO_RESULTS_MESSAGE =
  "I could not find relevant content in the Sitecore site to answer that question.";

function createFallbackStream(message: string): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(message);
      controller.close();
    },
  });
}

function formatContext(rows: MatchSitecoreContentRow[]): string {
  return rows
    .map(
      (row) =>
        `Item: ${row.item_name}\nField: ${row.field_name}\nContent: ${row.content}`,
    )
    .join("\n\n");
}

function mapSources(rows: MatchSitecoreContentRow[]): RAGResult["sources"] {
  return rows.map((row) => ({
    itemPath: row.item_path,
    itemName: row.item_name,
    fieldName: row.field_name,
    content: row.content,
    similarity: row.similarity,
  }));
}

/**
 * Creates a RAG query client for Sitecore content stored in Supabase.
 */
export function createRAGQuery(config: RAGConfig) {
  const matchThreshold = config.matchThreshold ?? 0.7;
  const matchCount = config.matchCount ?? 5;

  const supabase = createClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
  );

  const embeddingClient = new OpenAI({ apiKey: config.openAiApiKey });
  const openai = createOpenAI({ apiKey: config.openAiApiKey });

  async function embedQuestion(question: string): Promise<number[]> {
    const response = await embeddingClient.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });

    const embedding = response.data[0]?.embedding;

    if (!embedding) {
      throw new Error("Failed to generate question embedding");
    }

    return embedding;
  }

  return {
    /**
     * Answers a question using vector search over ingested Sitecore content.
     */
    async query(question: string): Promise<RAGResult> {
      const embedding = await embedQuestion(question);

     const { data, error } = await supabase.rpc("match_sitecore_content", {
  query_embedding: embedding,
  match_threshold: matchThreshold,
  match_count: matchCount,
  filter_site_name: config.siteName,
})

console.log('RAG debug:', { error, resultCount: data?.length, siteName: config.siteName, matchThreshold })

      if (error) {
        throw new Error(
          `Supabase match_sitecore_content failed: ${error.message}`,
        );
      }

      const matches = (data ?? []) as MatchSitecoreContentRow[];
      const sources = mapSources(matches);

      if (matches.length === 0) {
        return {
          answer: createFallbackStream(NO_RESULTS_MESSAGE),
          sources: [],
        };
      }

      const context = formatContext(matches);
      
      const prompt = `Context:\n${context}\n\nQuestion: ${question}`;

      const result = streamText({
        model: openai("gpt-4o-mini"),
        system: SYSTEM_PROMPT,
        prompt,
      });

      return {
        answer: result.textStream,
        sources,
      };
    },
  };
}
