import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  chunkContent,
  createEdgeClient,
  createEmbedder,
  type ContentChunk,
} from "next-sitecore-ai/server";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

const ROOT_PATHS = [
  "/sitecore/content/Sheppard/sheppard/Home/Data",
  "/sitecore/content/Sheppard/sheppard/Home/About Us",
  "/sitecore/content/Sheppard/sheppard/Home/Capabilities",
  "/sitecore/content/Sheppard/sheppard/Home/People",
];

const MAX_ITEMS = 50;
const CONTENT_FETCH_DELAY_MS = 100;

type EdgeClient = ReturnType<typeof createEdgeClient>;

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldSkipItem(name: string): boolean {
  return name.startsWith("__") || name === "Data";
}

/**
 * Recursively discovers Sitecore item paths that contain text content.
 */
async function discoverItemPaths(
  rootPath: string,
  edgeClient: EdgeClient,
  depth = 0,
): Promise<string[]> {
  if (depth > 5) {
    return [];
  }

  const children = await edgeClient.getItemChildren(rootPath);
  const results: string[] = [];

  for (const child of children) {
    if (shouldSkipItem(child.name)) {
      continue;
    }

    const childPath = child.path ?? `${rootPath}/${child.name}`;
    const fields = await edgeClient.getTextContent(childPath);
    await sleep(CONTENT_FETCH_DELAY_MS);

    if (Object.keys(fields).length > 0) {
      results.push(childPath);
    }

    const nested = await discoverItemPaths(childPath, edgeClient, depth + 1);
    results.push(...nested);
  }

  return [...new Set(results)];
}

/**
 * Runs the full Sitecore content ingestion pipeline.
 */
export async function main(): Promise<void> {
  const siteName = requireEnv("SITECORE_SITE_NAME");
  const language = process.env.SITECORE_DEFAULT_LANGUAGE ?? "en";

  const edge = createEdgeClient({
    edgeUrl: requireEnv("SITECORE_EDGE_URL"),
    apiKey: requireEnv("SITECORE_EDGE_TOKEN"),
    siteName,
    language,
  });

  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  const embedder = createEmbedder({
    openAiApiKey: requireEnv("OPENAI_API_KEY"),
  });

  const discoveredPaths: string[] = [];

  for (const rootPath of ROOT_PATHS) {
    const paths = await discoverItemPaths(rootPath, edge);

    for (const path of paths) {
      if (!discoveredPaths.includes(path)) {
        discoveredPaths.push(path);
      }
    }
  }

  console.log(`Discovered ${discoveredPaths.length} items to ingest`);

  let itemPaths = discoveredPaths;

  if (itemPaths.length > MAX_ITEMS) {
    console.warn(
      `Capping ingestion at ${MAX_ITEMS} items to avoid OpenAI rate limits`,
    );
    itemPaths = itemPaths.slice(0, MAX_ITEMS);
  }

  const allChunks: ContentChunk[] = [];
  let itemsProcessed = 0;

  for (const itemPath of itemPaths) {
    console.log(`Processing ${itemPath}`);

    const fields = await edge.getTextContent(itemPath);
    await sleep(CONTENT_FETCH_DELAY_MS);

    if (Object.keys(fields).length === 0) {
      console.log(`No content found for ${itemPath}, skipping`);
      continue;
    }

    const itemName = itemPath.split("/").pop() ?? itemPath;
    const chunks = chunkContent({
      itemPath,
      itemName,
      fields,
      siteName,
      language,
    });

    console.log(`Created ${chunks.length} chunks for ${itemPath}`);
    allChunks.push(...chunks);
    itemsProcessed += 1;
  }

  console.log(`Embedding ${allChunks.length} total chunks...`);
  const embedded = await embedder.embedChunks(allChunks);

  const rows = embedded.map((chunk) => ({
    item_path: chunk.itemPath,
    item_name: chunk.itemName,
    field_name: chunk.fieldName,
    content: chunk.content,
    site_name: chunk.siteName,
    language: chunk.language,
    embedding: chunk.embedding,
  }));

  const { error } = await supabase.from("sitecore_content").upsert(rows, {
    onConflict: "item_path,field_name",
  });

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  console.log("Ingestion complete");
  console.log(`Items processed: ${itemsProcessed}`);
  console.log(`Chunks created: ${allChunks.length}`);
  console.log(`Embeddings generated: ${embedded.length}`);
}

main().catch(console.error);
