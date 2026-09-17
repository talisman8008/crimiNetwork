export const API_BASE = "/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Fetch from FastAPI with the current session token attached. */
export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("netra-auth-token");
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token.replace(/^\"(.*)\"$/, "$1")}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (response.status === 401) {
    window.dispatchEvent(new Event("auth:unauthorized"));
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.detail ?? body?.error ?? response.statusText);
  }
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}
