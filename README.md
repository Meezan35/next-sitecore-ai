# next-sitecore-ai

An open-source AI toolkit that brings RAG, semantic search, and content suggestions to Sitecore XM Cloud + Next.js projects.

[![npm version](https://img.shields.io/npm/v/next-sitecore-ai.svg)](https://www.npmjs.com/package/next-sitecore-ai)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

**[Live Demo](https://your-demo-url.vercel.app)** · **[npm](https://npmjs.com/package/next-sitecore-ai)**

## Why this exists

Sitecore developers who want to add AI to their XM Cloud projects have no starting point. Experience Edge, embeddings, vector storage, and streaming LLM routes are all wired differently on every team.

Every team builds the same RAG pipeline, the same embedding infrastructure, the same hooks from scratch. This package eliminates that.

## What is included

| Package | Description |
| --- | --- |
| **Core hooks** | `useContentSuggestion`, `useSearchEnhance`, `usePersonalize` |
| **RAG pipeline** | Experience Edge ingestion, pgvector storage, semantic query |
| **MCP server** | Five tools exposing XM Cloud to AI agents like Cursor and Claude |
| **CLI** | `create-sitecore-ai-app` starter _(coming soon)_ |

## Quick start

**1. Install the package**

```bash
npm install next-sitecore-ai
```

**2. Set up environment variables**

Add these to `.env.local`:

| Variable | Description |
| --- | --- |
| `SITECORE_EDGE_URL` | Experience Edge GraphQL endpoint URL |
| `SITECORE_EDGE_TOKEN` | Experience Edge API key |
| `SITECORE_SITE_NAME` | Site name configured in XM Cloud |
| `SITECORE_DEFAULT_LANGUAGE` | Default content language (e.g. `en`) |
| `OPENAI_API_KEY` | OpenAI API key for embeddings and LLM calls |
| `SUPABASE_URL` | Supabase project URL for pgvector storage |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key for server-side writes and queries |

**3. Run the ingestion script**

Copy [`scripts/ingest.ts`](scripts/ingest.ts) into your project. Update the `ROOT_PATHS` array with your own Sitecore content paths:

```ts
const ROOT_PATHS = [
  '/sitecore/content/YourSite/yoursite/Home/Data',
  '/sitecore/content/YourSite/yoursite/Home/About',
  // add any root paths you want to crawl recursively
]
```

The script discovers all content items recursively under each root path, skips items with no meaningful text, and caps at 50 items per run to avoid rate limits. Then run:

```bash
npx tsx scripts/ingest.ts
```

**4. Use a hook**

```tsx
'use client';

import { useContentSuggestion } from 'next-sitecore-ai/client';

export function SuggestButton({ itemPath }: { itemPath: string }) {
  const { suggestion, suggest, isLoading } = useContentSuggestion(itemPath);

  return (
    <div>
      <button onClick={() => suggest()} disabled={isLoading}>
        Suggest improvements
      </button>
      {suggestion && <p>{suggestion}</p>}
    </div>
  );
}
```

You also need a matching API route at `/api/ai/suggest`. See the [demo app](apps/demo/app/api/ai/suggest/route.ts) for a full example.

## Hooks

Import hooks from `next-sitecore-ai/client`. Each hook calls a Next.js API route that you provide.

### useContentSuggestion

Streams AI-generated suggestions for a Sitecore item field. Posts `{ itemPath, fieldName? }` to `/api/ai/suggest`.

```tsx
'use client';

import { useContentSuggestion } from 'next-sitecore-ai/client';

const { suggestion, suggest, isLoading, error } = useContentSuggestion(
  '/sitecore/content/Site/home',
);

// Optional: pass a field name to focus the suggestion
suggest('Title');
```

### useSearchEnhance

Enhances search with AI-ranked semantic results. Posts `{ query }` to `/api/ai/search` and returns both enhanced and original result sets.

```tsx
'use client';

import { useSearchEnhance } from 'next-sitecore-ai/client';

const { results, search, isLoading } = useSearchEnhance();

await search('corporate litigation services');
```

### usePersonalize

Resolves a personalized content variant for a guest based on audience segments. Posts `{ guestId, variants }` to `/api/ai/personalize`.

```tsx
'use client';

import { usePersonalize, type ContentVariant } from 'next-sitecore-ai/client';

const variants: ContentVariant[] = [
  { itemPath: '/sitecore/content/Site/home', segmentName: 'Enterprise' },
  { itemPath: '/sitecore/content/Site/home-alt', segmentName: 'SMB' },
];

const { variant, segment, isLoading } = usePersonalize('guest-123', variants);
```

## RAG pipeline

The pipeline pulls text content from Experience Edge, chunks and embeds it with OpenAI, stores vectors in Supabase pgvector, and answers questions via semantic similarity search. Run ingestion once (or on a schedule) to keep the vector index in sync with published content.

```bash
npx tsx scripts/ingest.ts
```

Add a route handler that queries ingested content:

```ts
// app/api/ai/chat/route.ts
import { createRAGQuery } from 'next-sitecore-ai/server';

export async function POST(request: Request) {
  const { question } = await request.json();

  const rag = createRAGQuery({
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    openAiApiKey: process.env.OPENAI_API_KEY!,
    siteName: process.env.SITECORE_SITE_NAME!,
  });

  const { answer, sources } = await rag.query(question);

  return new Response(answer, {
    headers: { 'X-Sources': JSON.stringify(sources) },
  });
}
```

## MCP server

The MCP server exposes your XM Cloud content and vector index to AI coding agents. Install `@next-sitecore-ai/mcp-server` and add it to your MCP client configuration. It reads the same `.env.local` variables as the rest of the toolkit.

```json
{
  "mcpServers": {
    "sitecore": {
      "command": "node",
      "args": ["./node_modules/@next-sitecore-ai/mcp-server/dist/index.js"],
      "env": {
        "SITECORE_EDGE_URL": "https://your-edge-url",
        "SITECORE_EDGE_TOKEN": "your-edge-token",
        "SITECORE_SITE_NAME": "your-site-name",
        "SITECORE_DEFAULT_LANGUAGE": "en",
        "OPENAI_API_KEY": "your-openai-key",
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key"
      }
    }
  }
}
```

**Tools**

| Tool | Description |
| --- | --- |
| `get_item` | Fetch a Sitecore content item and all its fields by item path |
| `get_text_content` | Get plain text from an item with HTML stripped and system fields removed |
| `search_content` | Semantically search ingested content for a natural language query |
| `list_site_pages` | List top-level pages under a Sitecore root path |
| `get_site_info` | Return configured site name, language, and Edge endpoint |

## Requirements

- Next.js 14+
- React 18+
- Sitecore XM Cloud with Experience Edge
- OpenAI API key
- Supabase project with pgvector

## Contributing

Contributions are welcome — bug reports, feature requests, and pull requests all help. Open an [issue](https://github.com/Meezan35/next-sitecore-ai/issues/new) to discuss changes before submitting a PR.

## License

MIT
