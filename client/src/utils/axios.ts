type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type QueryParams = Record<string, string | number | boolean | null | undefined>;

export type AxiosResponse<T = any> = {
  data: T | null;
  status: number;
  statusText: string;
  ok: boolean;
  response: Response;
};

type RequestConfig = {
  headers?: HeadersInit;
  params?: QueryParams;
  auth?: boolean;
};

type BodyRequestConfig = RequestConfig & {
  data?: unknown;
};

const AUTH_TOKEN_KEY = "wai_auth_token";

let authToken: string | null = sessionStorage.getItem(AUTH_TOKEN_KEY);

export async function readApiJson<T = any>(response: Response): Promise<T | null> {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return { message: text } as T;
  }
}

export function formatApiError(
  response: Pick<Response, "status" | "statusText">,
  data: any,
  fallback: string,
) {
  const serverMessage = data?.message || data?.error;

  if (serverMessage) {
    return `${fallback}: ${serverMessage}`;
  }

  return `${fallback}. Server returned ${response.status} ${response.statusText || "error"}.`;
}

export const setAuthToken = (token: string) => {
  authToken = token;
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const getAuthToken = () => authToken || sessionStorage.getItem(AUTH_TOKEN_KEY);

export const hasAuthToken = () => Boolean(getAuthToken());

export const clearAuthToken = () => {
  authToken = null;
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
};

const clearTokenAndReload = () => {
  clearAuthToken();
  window.location.reload();
};

const hashToken = async (token: string) => {
  if (!crypto.subtle) return null;

  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const withParams = (url: string, params?: QueryParams) => {
  if (!params) return url;

  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });

  const query = search.toString();
  if (!query) return url;

  return `${url}${url.includes("?") ? "&" : "?"}${query}`;
};

async function request<T = any>(
  method: HttpMethod,
  url: string,
  config: BodyRequestConfig = {},
): Promise<AxiosResponse<T>> {
  const headers = new Headers(config.headers);
  const hasBody = config.data !== undefined;

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (config.auth !== false && !headers.has("Authorization")) {
    const token = getAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
      const tokenHash = await hashToken(token);
      if (tokenHash) headers.set("X-Auth-Token-Hash", tokenHash);
    }
  }

  const response = await fetch(withParams(url, config.params), {
    method,
    headers,
    body: hasBody ? JSON.stringify(config.data) : undefined,
  });
  const data = await readApiJson<T>(response);

  if (response.status === 401 && (data as any)?.code === "TOKEN_EXPIRED") {
    clearTokenAndReload();
  }

  return {
    data,
    status: response.status,
    statusText: response.statusText,
    ok: response.ok && (data as any)?.status !== "error",
    response,
  };
}

export const axios = {
  get: <T = any>(url: string, config?: RequestConfig) =>
    request<T>("GET", url, config),
  post: <T = any>(url: string, data?: unknown, config?: RequestConfig) =>
    request<T>("POST", url, { ...config, data }),
  patch: <T = any>(url: string, data?: unknown, config?: RequestConfig) =>
    request<T>("PATCH", url, { ...config, data }),
  put: <T = any>(url: string, data?: unknown, config?: RequestConfig) =>
    request<T>("PUT", url, { ...config, data }),
  delete: <T = any>(url: string, config?: RequestConfig) =>
    request<T>("DELETE", url, config),
  request,
};

export default axios;
