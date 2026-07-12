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

export class KimaiClient {
  private readonly http: AxiosInstance;

  constructor(config: KimaiConfig) {
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

  post<T>(path: string, data?: Record<string, unknown>, params?: Record<string, unknown>): Promise<KimaiResponse<T>> {
    return this.request<T>("POST", path, { data: pruneUndefined(data), params: pruneUndefined(params) });
  }

  patch<T>(path: string, data?: Record<string, unknown>, params?: Record<string, unknown>): Promise<KimaiResponse<T>> {
    return this.request<T>("PATCH", path, { data: pruneUndefined(data), params: pruneUndefined(params) });
  }
}

function normalizePath(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return cleanPath.includes("?") ? cleanPath : cleanPath.replace(/\/+$/, "");
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
