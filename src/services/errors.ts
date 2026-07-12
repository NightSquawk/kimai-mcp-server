import axios from "axios";

export function formatApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const status = error.response.status;
      const detail = formatErrorData(error.response.data);

      if (status === 401 || status === 403) {
        return `Kimai denied the request (${status}). Check KIMAI_API_TOKEN and the user's API permissions.${detail}`;
      }

      if (status === 404) {
        return `Kimai resource not found (404). Check the ID and endpoint path.${detail}`;
      }

      if (status === 429) {
        return `Kimai rate limited the request (429). Retry later or reduce request volume.${detail}`;
      }

      return `Kimai API request failed (${status}).${detail}`;
    }

    if (error.code === "ECONNABORTED") {
      return "Kimai API request timed out. Increase KIMAI_TIMEOUT_MS or narrow the query.";
    }

    if (error.code) {
      return `Kimai API connection failed (${error.code}). Check KIMAI_BASE_URL and network access.`;
    }
  }

  return `Unexpected Kimai error: ${error instanceof Error ? error.message : String(error)}`;
}

function formatErrorData(data: unknown): string {
  if (data === undefined || data === null) return "";
  if (typeof data === "string") return ` Response: ${data}`;

  try {
    return ` Response: ${JSON.stringify(data)}`;
  } catch {
    return "";
  }
}
