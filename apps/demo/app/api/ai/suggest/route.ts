import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { createEdgeClient } from "next-sitecore-ai/server";

const SYSTEM_PROMPT =
  "You are a content editor assistant for a law firm website. Suggest improvements to the provided website content. Be specific, professional, and concise.";

interface SuggestBody {
  itemPath?: string;
  fieldName?: string;
  prompt?: string;
}

function parseSuggestBody(body: SuggestBody): {
  itemPath?: string;
  fieldName?: string;
} {
  if (typeof body.itemPath === "string") {
    return {
      itemPath: body.itemPath,
      fieldName:
        typeof body.fieldName === "string" ? body.fieldName : undefined,
    };
  }

  if (typeof body.prompt === "string") {
    try {
      const parsed = JSON.parse(body.prompt) as {
        itemPath?: string;
        fieldName?: string;
      };

      return {
        itemPath:
          typeof parsed.itemPath === "string" ? parsed.itemPath : undefined,
        fieldName:
          typeof parsed.fieldName === "string" ? parsed.fieldName : undefined,
      };
    } catch {
      return {};
    }
  }

  return {};
}

function formatContentContext(content: Record<string, string>): string {
  return Object.entries(content)
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");
}

/**
 * Streams AI content suggestions for a Sitecore item.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const REQUIRED_ENV = [
      "SITECORE_EDGE_URL",
      "SITECORE_EDGE_TOKEN",
      "SITECORE_SITE_NAME",
      "SITECORE_DEFAULT_LANGUAGE",
      "OPENAI_API_KEY",
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

    const body = (await request.json()) as SuggestBody;
    const { itemPath, fieldName } = parseSuggestBody(body);

    if (!itemPath) {
      return Response.json(
        { error: "itemPath is required" },
        { status: 400 },
      );
    }

    const edge = createEdgeClient({
      edgeUrl: requireEnv("SITECORE_EDGE_URL"),
      apiKey: requireEnv("SITECORE_EDGE_TOKEN"),
      siteName: requireEnv("SITECORE_SITE_NAME"),
      language: requireEnv("SITECORE_DEFAULT_LANGUAGE"),
    });

    const content = await edge.getTextContent(itemPath);

    if (Object.keys(content).length === 0) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    const context = formatContentContext(content);
    const fieldFocus = fieldName ? ` focusing on the ${fieldName} field` : "";
    const prompt = `Here is the current content for ${itemPath}${fieldFocus}:\n\n${context}\n\nSuggest improvements.`;

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: SYSTEM_PROMPT,
      prompt,
    });

    return result.toDataStreamResponse();
 } catch (error) {
  console.error('Suggest route error:', error)
  return Response.json({ 
    error: error instanceof Error ? error.message : 'Internal server error' 
  }, { status: 500 })
}}