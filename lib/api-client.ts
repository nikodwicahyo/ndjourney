type ApiResponse<T> = {
  data?: T;
  error?: string;
  status: number;
};

type ApiErrorResponse = { error: string };

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
  options?: {
    headers?: Record<string, string>;
    signal?: AbortSignal;
    cache?: RequestCache;
  },
): Promise<ApiResponse<T>> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options?.headers,
    };

    const controller = new AbortController();
    // ponytail: honour caller signal AND our timeout (old code aborted an unused controller).
    const signal = options?.signal
      ? typeof AbortSignal.any === "function"
        ? AbortSignal.any([options.signal, controller.signal])
        : options.signal
      : controller.signal;

    const timeoutId = setTimeout(() => controller.abort(), 30000);
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal,
        cache: options?.cache,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    let json: T | ApiErrorResponse | null = null;
    try {
      json = await res.json();
    } catch {
      // Response may be empty (e.g. 204 No Content)
    }

    if (!res.ok) {
      const errorMsg =
        (json as ApiErrorResponse)?.error ||
        (json as { message?: string })?.message ||
        `Request failed with status ${res.status}`;
      return { error: errorMsg, status: res.status };
    }

    return {
      data: json as T,
      status: res.status,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { error: "Request timed out", status: 0 };
    }
    return {
      error: err instanceof Error ? err.message : "Network error",
      status: 0,
    };
  }
}

export const api = {
  get: <T>(url: string, options?: { headers?: Record<string, string>; signal?: AbortSignal; cache?: RequestCache }) =>
    request<T>("GET", url, undefined, options),

  post: <T>(url: string, body?: unknown, options?: { headers?: Record<string, string>; signal?: AbortSignal }) =>
    request<T>("POST", url, body, options),

  put: <T>(url: string, body?: unknown, options?: { headers?: Record<string, string>; signal?: AbortSignal }) =>
    request<T>("PUT", url, body, options),

  delete: <T>(url: string, options?: { headers?: Record<string, string>; signal?: AbortSignal }) =>
    request<T>("DELETE", url, undefined, options),

  upload: async <T>(url: string, formData: FormData, options?: { signal?: AbortSignal }): Promise<ApiResponse<T>> => {
    try {
      const controller = new AbortController();
      const signal =
        options?.signal && typeof AbortSignal.any === "function"
          ? AbortSignal.any([options.signal, controller.signal])
          : (options?.signal ?? controller.signal);
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          body: formData,
          signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      // ponytail: empty/204/non-JSON must not throw here.
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        return {
          error: json.error || `Upload gagal dengan status ${res.status}`,
          status: res.status,
        };
      }

      return { data: json as T, status: res.status };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { error: "Upload timed out", status: 0 };
      }
      return {
        error: err instanceof Error ? err.message : "Upload gagal",
        status: 0,
      };
    }
  },
};
