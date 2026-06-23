/** Package version placeholder until release tooling is added. */
export const VERSION = "0.0.1";

export {
  createEdgeClient,
  type EdgeClientConfig,
  type ImageFieldValue,
  type LinkFieldValue,
  type SitecoreField,
  type SitecoreFieldValue,
  type SitecoreItem,
} from "./client/edge-client";

export { chunkContent, type ContentChunk } from "./rag/chunker";

export { createEmbedder, type EmbedderConfig } from "./rag/embedder";

export {
  createRAGQuery,
  type RAGConfig,
  type RAGResult,
} from "./rag/query";