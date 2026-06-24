import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
type SearchResult = {
  id: string;
  title: string;
  url: string;
  description: string;
  score: number;
};

interface MatchSitecoreContentRow {
  item_path: string;
  item_name: string;
  field_name: string;
  content: string;
  similarity: number;
}

function truncateDescription(content: string, maxLength = 150): string {
  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, maxLength).trimEnd()}...`;
}

function mapSearchResults(rows: MatchSitecoreContentRow[]): SearchResult[] {
  return rows.map((row) => ({
    id: `${row.item_path}:${row.field_name}`,
    title: row.item_name,
    url: row.item_path,
    description: truncateDescription(row.content),
    score: row.similarity,
  }));
}

const MOCK_ORIGINAL_RESULTS: SearchResult[] = [
  { id: 'kw-1', title: 'Legal Services Overview', url: '/services', description: 'Overview of all legal services offered by the firm across practice areas.', score: 0.9 },
  { id: 'kw-2', title: 'Practice Areas', url: '/practices', description: 'Browse our full list of practice areas including litigation, corporate, and advisory.', score: 0.7 },
  { id: 'kw-3', title: 'Industry Groups', url: '/industries', description: 'Specialized legal counsel across industries including technology, finance, and healthcare.', score: 0.5 },
]

/**
 * Returns AI-enhanced search results compared against mock baseline results.
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

    const body = (await request.json()) as { query?: string };
    const { query } = body;

    if (!query) {
      return Response.json({ error: "query is required" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });

    const embedding = embeddingResponse.data[0]?.embedding;

    if (!embedding) {
      throw new Error("Failed to generate query embedding");
    }

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data, error } = await supabase.rpc("match_sitecore_content", {
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: 10,
      filter_site_name: requireEnv("SITECORE_SITE_NAME"),
    });

    if (error) {
      throw new Error(`Supabase match_sitecore_content failed: ${error.message}`);
    }

    const results = mapSearchResults((data ?? []) as MatchSitecoreContentRow[]);

    return Response.json({
      results,
      originalResults: MOCK_ORIGINAL_RESULTS,
    });
  } catch (error) {
  console.error('Route error:', error)
  return Response.json({ 
    error: error instanceof Error ? error.message : 'Internal server error' 
  }, { status: 500 })
}}
