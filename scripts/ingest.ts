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

const ITEM_PATHS = [
  "/sitecore/content/Sheppard/sheppard/Home/Data/Hero Banner Folder/Hero Banner",
  "/sitecore/content/Sheppard/sheppard/Home/Data/PromoModule",
  "/sitecore/content/Sheppard/sheppard/Home/Data/PromoModule1",
  "/sitecore/content/Sheppard/sheppard/Home/Data/Content Card",
  "/sitecore/content/Sheppard/sheppard/Home/Data/Quote",
  "/sitecore/content/Sheppard/sheppard/Home/About Us",
  "/sitecore/content/Sheppard/sheppard/Home/Capabilities",
];

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
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

  const allChunks: ContentChunk[] = [];
  let itemsProcessed = 0;

  for (const itemPath of ITEM_PATHS) {
    const fields = await edge.getTextContent(itemPath);

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