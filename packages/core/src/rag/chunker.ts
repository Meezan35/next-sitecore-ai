export interface ContentChunk {
  itemPath: string;
  itemName: string;
  fieldName: string;
  content: string;
  siteName: string;
  language: string;
}

const MIN_FIELD_LENGTH = 20;
const WORDS_PER_CHUNK = 500;
const WORD_OVERLAP = 50;

/**
 * Estimates token count from word count using a 1.3x multiplier.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);
}

function splitIntoWordChunks(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length <= WORDS_PER_CHUNK) {
    return [text];
  }

  const chunks: string[] = [];
  const stride = WORDS_PER_CHUNK - WORD_OVERLAP;

  for (let start = 0; start < words.length; start += stride) {
    const chunkWords = words.slice(start, start + WORDS_PER_CHUNK);

    if (chunkWords.length === 0) {
      break;
    }

    chunks.push(chunkWords.join(" "));

    if (start + WORDS_PER_CHUNK >= words.length) {
      break;
    }
  }

  return chunks;
}

/**
 * Splits Sitecore field text into RAG-ready content chunks.
 */
export function chunkContent(params: {
  itemPath: string;
  itemName: string;
  fields: Record<string, string>;
  siteName: string;
  language: string;
  maxTokens?: number;
}): ContentChunk[] {
  const { itemPath, itemName, fields, siteName, language } = params;
  const chunks: ContentChunk[] = [];

  for (const [fieldName, value] of Object.entries(fields)) {
    if (value.length < MIN_FIELD_LENGTH) {
      continue;
    }

    const textChunks = splitIntoWordChunks(value);

    for (const content of textChunks) {
      if (params.maxTokens !== undefined && estimateTokens(content) > params.maxTokens) {
        continue;
      }

      chunks.push({
        itemPath,
        itemName,
        fieldName,
        content,
        siteName,
        language,
      });
    }
  }

  return chunks;
}