import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";
import type { KimaiConfig, KimaiMethod } from "../types.js";

export interface KimaiResponse<T> {
  data: T;
  pagination: {
    page?: number;
    total_count?: number;
    total_pages?: number;
    per_page?: number;
  };
}

/**
 * Kimai request bodies are usually objects, but /api/users/{id}/preferences and
 * /api/invoices/{id}/custom-fields both read a bare JSON array via
 * `$request->request->all()`, so arrays must survive to axios unchanged.
 */
export type RequestBody = Record<string, unknown> | unknown[];

export class KimaiClient {
  private readonly http: AxiosInstance;

  /** Mirrors KIMAI_ALLOW_DELETE so delete tools can gate before sending. */
  readonly allowDelete: boolean;

  constructor(config: KimaiConfig) {
    this.allowDelete = config.allowDelete;
    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiToken}`
      }
    });
  }

  async request<T>(
    method: KimaiMethod,
    path: string,
    options: Pick<AxiosRequestConfig, "data" | "params"> = {}
  ): Promise<KimaiResponse<T>> {
    const response = await this.http.request<T>({
      method,
      url: normalizePath(path),
      ...options
    });

    return {
      data: response.data,
      pagination: extractPagination(response)
    };
  }

  get<T>(path: string, params?: Record<string, unknown>): Promise<KimaiResponse<T>> {
    return this.request<T>("GET", path, { params: pruneUndefined(params) });
  }

  post<T>(path: string, data?: RequestBody, params?: Record<string, unknown>): Promise<KimaiResponse<T>> {
    return this.request<T>("POST", path, { data: pruneBody(data), params: pruneUndefined(params) });
  }

  patch<T>(path: string, data?: RequestBody, params?: Record<string, unknown>): Promise<KimaiResponse<T>> {
    return this.request<T>("PATCH", path, { data: pruneBody(data), params: pruneUndefined(params) });
  }

  /**
   * Kimai answers a successful delete with 204 No Content, so `data` is an
   * empty string rather than a body. Callers must not treat that as a failure.
   */
  delete<T>(path: string, params?: Record<string, unknown>): Promise<KimaiResponse<T>> {
    return this.request<T>("DELETE", path, { params: pruneUndefined(params) });
  }

  /**
   * Fetch a binary payload such as a rendered invoice. Kept separate from
   * request() because the JSON Accept header and the default response parsing
   * would corrupt the bytes.
   */
  async getBinary(path: string): Promise<{ data: Buffer; contentType?: string; filename?: string }> {
    const response = await this.http.request<ArrayBuffer>({
      method: "GET",
      url: normalizePath(path),
      responseType: "arraybuffer",
      headers: { Accept: "*/*" }
    });

    return {
      data: Buffer.from(response.data),
      contentType: headerValue(response.headers["content-type"]),
      filename: parseFilename(headerValue(response.headers["content-disposition"]))
    };
  }
}

function headerValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Pull a filename out of a Content-Disposition header, if Kimai sent one. */
function parseFilename(disposition?: string): string | undefined {
  if (!disposition) return undefined;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return match?.[1];
}

function normalizePath(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return cleanPath.includes("?") ? cleanPath : cleanPath.replace(/\/+$/, "");
}

function pruneBody(data?: RequestBody): RequestBody | undefined {
  return Array.isArray(data) ? data : pruneUndefined(data);
}

function pruneUndefined(params?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!params) return undefined;

  const entries = Object.entries(params).filter(([, value]) => {
    if (value === undefined || value === null || value === "") return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function extractPagination<T>(response: AxiosResponse<T>): KimaiResponse<T>["pagination"] {
  const headers = response.headers;
  return {
    page: toNumber(headers["x-page"]),
    total_count: toNumber(headers["x-total-count"]),
    total_pages: toNumber(headers["x-total-pages"]),
    per_page: toNumber(headers["x-per-page"])
  };
}

function toNumber(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
