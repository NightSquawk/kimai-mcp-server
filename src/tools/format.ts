import { RESPONSE_CHARACTER_LIMIT } from "../constants.js";
import type { KimaiResponse } from "../services/kimai-client.js";
import type { PaginatedItems, ResponseFormat, ToolResponse } from "../types.js";

export function paginateResponse<T>(response: KimaiResponse<unknown>, page: number, size: number): PaginatedItems<T> {
  const items = extractItems<T>(response.data);
  const total = response.pagination.total_count ?? items.length;
  const totalPages = response.pagination.total_pages;
  const currentPage = response.pagination.page ?? page;
  const hasMore = totalPages !== undefined ? currentPage < totalPages : items.length === size;

  return {
    total,
    count: items.length,
    page: currentPage,
    size: response.pagination.per_page ?? size,
    items,
    has_more: hasMore,
    ...(hasMore ? { next_page: currentPage + 1 } : {}),
    ...(totalPages !== undefined ? { total_pages: totalPages } : {})
  };
}

export function makeToolResponse<T extends Record<string, unknown>>(data: T, text: string, isError = false): ToolResponse<T> {
  const responseText = text.length > RESPONSE_CHARACTER_LIMIT
    ? `${text.slice(0, RESPONSE_CHARACTER_LIMIT)}\n\nResponse truncated at ${RESPONSE_CHARACTER_LIMIT} characters. Use filters or a smaller page size.`
    : text;

  return {
    content: [{ type: "text", text: responseText }],
    structuredContent: data,
    ...(isError ? { isError: true } : {})
  };
}

export function formatResponse<T>(format: ResponseFormat, data: T, markdown: string): string {
  return format === "json" ? JSON.stringify(data, null, 2) : markdown;
}

export function summarizeRecord(record: unknown, preferredFields: string[]): string {
  if (!record || typeof record !== "object") {
    return String(record);
  }

  const source = record as Record<string, unknown>;
  const fields = preferredFields
    .filter((field) => source[field] !== undefined && source[field] !== null && source[field] !== "")
    .map((field) => `${field}: ${formatInline(source[field])}`);

  return fields.length > 0 ? fields.join(", ") : JSON.stringify(record);
}

export function extractItems<T = unknown>(raw: unknown): T[] {
  if (Array.isArray(raw)) {
    return raw as T[];
  }

  if (raw && typeof raw === "object") {
    const source = raw as Record<string, unknown>;
    for (const key of ["results", "items", "data", "rows"]) {
      if (Array.isArray(source[key])) {
        return source[key] as T[];
      }
    }
  }

  return raw === undefined || raw === null ? [] : [raw as T];
}

function formatInline(value: unknown): string {
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    if (typeof source.name === "string") return source.name;
    if (typeof source.username === "string") return source.username;
    if (typeof source.alias === "string") return source.alias;
    if (typeof source.id === "number" || typeof source.id === "string") return String(source.id);
    return JSON.stringify(value);
  }

  return String(value);
}
