import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { VERSION } from "next-sitecore-ai";

const server = new Server(
  {
    name: "next-sitecore-ai",
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "ping",
      description: "Health check for the next-sitecore-ai MCP server",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "ping") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  return {
    content: [{ type: "text", text: "pong" }],
  };
});

/**
 * Starts the MCP server over stdio transport.
 */
export async function startServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isMainModule =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === fileURLToPath(process.argv[1]);

if (isMainModule) {
  startServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("MCP server failed to start:", message);
    process.exit(1);
  });
}
