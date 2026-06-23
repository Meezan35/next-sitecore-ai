import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { createRAGQuery } from "next-sitecore-ai/server";

const SYSTEM_PROMPT =
  "You are a helpful assistant for a law firm website. Answer questions using only the provided website content. If the content does not contain the answer, say so clearly.";

function formatSourcesContext(
  sources: Array<{
    itemName: string;
    fieldName: string;
    content: string;
  }>,
): string {
  return sources
    .map(
      (source) =>
        `[${source.itemName} - ${source.fieldName}]: ${source.content}`,
    )
    .join("\n\n");
}

/**
 * Answers questions using RAG over ingested Sitecore content.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const REQUIRED_ENV = [
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "OPENAI_API_KEY",
      "SITECORE_SITE_NAME",
    ] as const;

    function requireEnv(name: string): string {
      const value = process.env[name];

      if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
      }

      return value;
    }

    for (const name of REQUIRED_ENV) {
      requireEnv(name);
    }

    const body = (await request.json()) as { question?: string };
    const { question } = body;

    if (!question) {
      return Response.json({ error: "question is required" }, { status: 400 });
    }

    const rag = createRAGQuery({
      supabaseUrl: requireEnv("SUPABASE_URL"),
      supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      openAiApiKey: requireEnv("OPENAI_API_KEY"),
      siteName: requireEnv("SITECORE_SITE_NAME"),
      matchThreshold: 0.1,
      matchCount: 5,
    });

    const { sources } = await rag.query(question);
    const context = formatSourcesContext(sources);
    const prompt =
      sources.length > 0
        ? `Context:\n${context}\n\nQuestion: ${question}`
        : question;

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: SYSTEM_PROMPT,
      prompt,
    });

    return result.toDataStreamResponse({
      headers: {
        "X-Sources": JSON.stringify(sources),
      },
    });
  } catch (error) {
    console.error("Route error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
