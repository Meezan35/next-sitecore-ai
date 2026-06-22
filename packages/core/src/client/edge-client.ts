export type SitecoreFieldValue = string | ImageFieldValue | LinkFieldValue | null;

export interface ImageFieldValue {
  src: string;
  alt: string;
  width: string;
  height: string;
}

export interface LinkFieldValue {
  href: string;
  linktype: string;
  target: string;
  id: string;
}

export interface SitecoreField {
  name: string;
  jsonValue: { value: SitecoreFieldValue } | unknown[];
}

export interface SitecoreItem {
  id: string;
  name: string;
  path?: string;
  fields: SitecoreField[];
}

export interface EdgeClientConfig {
  edgeUrl: string;
  apiKey: string;
  siteName: string;
  language?: string;
}

interface GraphQLItemResponse {
  data?: {
    item?: SitecoreItem | null;
  };
}

interface GraphQLChildrenResponse {
  data?: {
    item?: {
      children?: {
        results?: SitecoreItem[] | null;
      } | null;
    } | null;
  };
}

type NextFetchOptions = RequestInit & {
  next?: { revalidate?: number };
};

const GET_ITEM_QUERY = `
  query GetItem($path: String!, $language: String!) {
    item(path: $path, language: $language) {
      id
      name
      fields { name jsonValue }
    }
  }
`;

const GET_CHILDREN_QUERY = `
  query GetChildren($path: String!, $language: String!) {
    item(path: $path, language: $language) {
      children {
        results {
          id
          name
          fields { name jsonValue }
        }
      }
    }
  }
`;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function isSystemField(fieldName: string): boolean {
  return fieldName.startsWith("__");
}

function extractTextValue(field: SitecoreField): string {
  const { jsonValue } = field;

  if (Array.isArray(jsonValue)) {
    return "";
  }

  const value = jsonValue.value;

  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return stripHtml(value);
  }

  if (typeof value === "object") {
    if ("alt" in value && typeof value.alt === "string") {
      return value.alt;
    }

    if ("href" in value && typeof value.href === "string") {
      return value.href;
    }
  }

  return "";
}

async function executeGraphQL<T>(
  config: EdgeClientConfig,
  query: string,
  variables: Record<string, string>,
): Promise<T> {
  const response = await fetch(config.edgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      sc_apikey: config.apiKey,
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 300 },
  } as NextFetchOptions);

  if (!response.ok) {
    throw new Error(
      `Experience Edge request failed (${response.status} ${response.statusText}) for site "${config.siteName}" at ${config.edgeUrl}`,
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Creates an Experience Edge GraphQL client for fetching Sitecore content.
 */
export function createEdgeClient(config: EdgeClientConfig) {
  const language = config.language ?? "en";

  /**
   * Fetches a single Sitecore item by path.
   */
  async function getItem(itemPath: string): Promise<SitecoreItem | null> {
    const result = await executeGraphQL<GraphQLItemResponse>(
      config,
      GET_ITEM_QUERY,
      { path: itemPath, language },
    );

    return result.data?.item ?? null;
  }

  /**
   * Fetches child items under a parent path.
   */
  async function getItemChildren(parentPath: string): Promise<SitecoreItem[]> {
    const result = await executeGraphQL<GraphQLChildrenResponse>(
      config,
      GET_CHILDREN_QUERY,
      { path: parentPath, language },
    );

    return result.data?.item?.children?.results ?? [];
  }

  /**
   * Fetches an item and returns a map of field names to plain text values.
   */
  async function getTextContent(
    itemPath: string,
  ): Promise<Record<string, string>> {
    const item = await getItem(itemPath);

    if (!item) {
      return {};
    }

    const content: Record<string, string> = {};

    for (const field of item.fields) {
      if (isSystemField(field.name)) {
        continue;
      }

      const text = extractTextValue(field);

      if (text) {
        content[field.name] = text;
      }
    }

    return content;
  }

  return { getItem, getItemChildren, getTextContent };
}