export type KimaiMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type ResponseFormat = "markdown" | "json";

export interface KimaiConfig {
  baseUrl: string;
  apiToken: string;
  timeoutMs: number;
  /** Whether KIMAI_ALLOW_DELETE opted this process in to irreversible deletes. */
  allowDelete: boolean;
}

export interface PaginatedItems<T> {
  [key: string]: unknown;
  total: number;
  count: number;
  page: number;
  size: number;
  items: T[];
  has_more: boolean;
  next_page?: number;
  total_pages?: number;
}

export interface ToolResponse<T extends Record<string, unknown>> {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  structuredContent: T;
  isError?: boolean;
}
