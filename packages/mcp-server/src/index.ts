import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  createEdgeClient,
  createRAGQuery,
  type RAGResult,
  type SitecoreField,
  type SitecoreItem,
} from "next-sitecore-ai/server";

const SERVER_NAME = "sitecore-xm-cloud";
const SERVER_VERSION = "0.0.1";
const DEFAULT_ROOT_PATH = "/sitecore/content/Sheppard/sheppard/Home";

const REQUIRED_ENV = [
  "SITECORE_EDGE_URL",
  "SITECORE_EDGE_TOKEN",
  "SITECORE_SITE_NAME",
  "SITECORE_DEFAULT_LANGUAGE",
  "OPENAI_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

loadEnv({ path: resolve(process.cwd(), ".env.local"), quiet: true });

/** Reads a required environment variable or throws a descriptive error. */
function requireEnv(name: (typeof REQUIRED_ENV)[number]): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Validates all required environment variables at startup. */
function loadConfig() {
  for (const name of REQUIRED_ENV) {
    requireEnv(name);
  }

  return {
    edgeUrl: process.env.SITECORE_EDGE_URL!,
    edgeToken: process.env.SITECORE_EDGE_TOKEN!,
    siteName: process.env.SITECORE_SITE_NAME!,
    language: process.env.SITECORE_DEFAULT_LANGUAGE!,
    openAiApiKey: process.env.OPENAI_API_KEY!,
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  };
}

/** Extracts the display value from a Sitecore field. */
function fieldValue(field: SitecoreField): unknown {
  const { jsonValue } = field;
  if (jsonValue === null || jsonValue === undefined) {
    return null;
  }
  if (Array.isArray(jsonValue)) {
    return jsonValue;
  }
  if (typeof jsonValue === "object" && "value" in jsonValue) {
    return jsonValue.value;
  }
  return jsonValue;
}

/** Builds an MCP tool error result from a caught exception. */
function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

/** Joins a parent Sitecore path with a child item name. */
function joinItemPath(parentPath: string, childName: string): string {
  return `${parentPath.replace(/\/$/, "")}/${childName}`;
}

const config = loadConfig();

const edgeClient = createEdgeClient({
  edgeUrl: config.edgeUrl,
  apiKey: config.edgeToken,
  siteName: config.siteName,
  language: config.language,
});

const ragQuery = createRAGQuery({
  supabaseUrl: config.supabaseUrl,
  supabaseServiceRoleKey: config.supabaseServiceRoleKey,
  openAiApiKey: config.openAiApiKey,
  siteName: config.siteName,
  matchThreshold: 0.3,
  matchCount: 5,
});

const server = new Server(
  { name: SERVER_NAME, version: SERVER_VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_item",
      description:
        "Fetch a Sitecore content item and all its fields by item path",
      inputSchema: {
        type: "object",
        properties: {
          itemPath: {
            type: "string",
            description:
              "Full Sitecore item path e.g. /sitecore/content/Site/home",
          },
        },
        required: ["itemPath"],
      },
    },
    {
      name: "get_text_content",
      description:
        "Get clean plain text content from a Sitecore item, with HTML stripped and system fields removed",
      inputSchema: {
        type: "object",
        properties: {
          itemPath: {
            type: "string",
            description: "Full Sitecore item path",
          },
        },
        required: ["itemPath"],
      },
    },
    {
      name: "search_content",
      description:
        "Semantically search Sitecore content using AI. Returns the most relevant content chunks for a given question or query.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural language search query or question",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "list_site_pages",
      description: "List all top-level pages in the Sitecore site",
      inputSchema: {
        type: "object",
        properties: {
          rootPath: {
            type: "string",
            description: "Root path to list pages from",
            default: DEFAULT_ROOT_PATH,
          },
        },
      },
    },
    {
      name: "get_site_info",
      description:
        "Get information about the configured Sitecore site including site name, language, and Edge endpoint",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const toolArgs = (args ?? {}) as Record<string, unknown>;

  switch (name) {
    case "get_item": {
      try {
        const itemPath = toolArgs.itemPath;
        if (typeof itemPath !== "string" || !itemPath) {
          return toolError(
            new Error("itemPath is required and must be a string"),
          );
        }

        const item = await edgeClient.getItem(itemPath);
        if (!item) {
          return {
            content: [
              { type: "text", text: `Item not found at path: ${itemPath}` },
            ],
            isError: true,
          };
        }

        const formatted = {
          id: item.id,
          name: item.name,
          fields: Object.fromEntries(
            item.fields.map((field: SitecoreField) => [
              field.name,
              fieldValue(field),
            ]),
          ),
        };

        return {
          content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }],
        };
      } catch (error) {
        return toolError(error);
      }
    }

    case "get_text_content": {
      try {
        const itemPath = toolArgs.itemPath;
        if (typeof itemPath !== "string" || !itemPath) {
          return toolError(
            new Error("itemPath is required and must be a string"),
          );
        }

        const content = await edgeClient.getTextContent(itemPath);
        const entries = Object.entries(content);

        if (entries.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No text content found at path: ${itemPath}`,
              },
            ],
          };
        }

        const text = entries
          .map(([fieldName, value]) => `${fieldName}: ${value}`)
          .join("\n\n");

        return { content: [{ type: "text", text }] };
      } catch (error) {
        return toolError(error);
      }
    }

    case "search_content": {
      try {
        const query = toolArgs.query;
        if (typeof query !== "string" || !query) {
          return toolError(new Error("query is required and must be a string"));
        }

        const { sources } = await ragQuery.query(query);

        if (sources.length === 0) {
          return {
            content: [{ type: "text", text: "No matching content found." }],
          };
        }

        const text = sources
          .map(
            (source: RAGResult["sources"][number], index: number) =>
              `${index + 1}. Item: ${source.itemName}\n   Field: ${source.fieldName}\n   Content: ${source.content}\n   Similarity: ${source.similarity.toFixed(4)}`,
          )
          .join("\n\n");

        return { content: [{ type: "text", text }] };
      } catch (error) {
        return toolError(error);
      }
    }

    case "list_site_pages": {
      try {
        const rootPath =
          typeof toolArgs.rootPath === "string" && toolArgs.rootPath
            ? toolArgs.rootPath
            : DEFAULT_ROOT_PATH;

        const children = await edgeClient.getItemChildren(rootPath);

        if (children.length === 0) {
          return {
            content: [
              { type: "text", text: `No child pages found under: ${rootPath}` },
            ],
          };
        }

        const text = children
          .map(
            (child: SitecoreItem, index: number) =>
              `${index + 1}. ${child.name}\n   Path: ${joinItemPath(rootPath, child.name)}`,
          )
          .join("\n\n");

        return { content: [{ type: "text", text }] };
      } catch (error) {
        return toolError(error);
      }
    }

    case "get_site_info": {
      try {
        const text = [
          `Site name: ${config.siteName}`,
          `Default language: ${config.language}`,
          `Edge URL: ${config.edgeUrl}`,
        ].join("\n");

        return { content: [{ type: "text", text }] };
      } catch (error) {
        return toolError(error);
      }
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
