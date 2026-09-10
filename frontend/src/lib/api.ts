// frontend/src/lib/api.ts
// Phase 1: minimal typed fetch wrapper + real JWT auth against FastAPI.
// No external deps (no axios). Token is stored under "netra-token" in localStorage.

const TOKEN_KEY = "netra-token";

const BASE_URL: string =
    (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

/** ---- token helpers ---- */

export function getToken(): string | null {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

export function setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
}

/** ---- error type ---- */

export class ApiError extends Error {
    readonly status: number;
    readonly body: unknown;
    constructor(message: string, status: number, body: unknown) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.body = body;
    }
}

/** ---- core request ---- */

interface RequestOptions extends RequestInit {
    /** Skip the Authorization header for this call (e.g. login). */
    skipAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { skipAuth, headers: initHeaders, ...rest } = options;
    const headers = new Headers(initHeaders ?? {});

    if (!skipAuth) {
        const token = getToken();
        if (token && !headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${token}`);
        }
    }

    const res = await fetch(`${BASE_URL}${path}`, { ...rest, headers });

    if (!res.ok) {
        let body: unknown = null;
        try {
            const ct = res.headers.get("content-type") ?? "";
            body = ct.includes("application/json") ? await res.json() : await res.text();
        } catch {
            body = null;
        }
        const message = `API ${options.method ?? "GET"} ${path} failed: ${res.status} ${res.statusText}`;
        throw new ApiError(message, res.status, body);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
}

/** ---- typed responses ---- */

export interface LoginResponse {
    access_token: string;
    badge_id: string;
    role?: string;
    [key: string]: unknown;
}

/** ---- auth ---- */

/**
 * POST /api/auth/login with form-encoded username + password.
 * Backend reads form.get("username") as badge_id. Returns the parsed JWT payload.
 */
export async function login(username: string, password: string): Promise<LoginResponse> {
    const form = new URLSearchParams();
    form.set("username", username);
    form.set("password", password);

    return request<LoginResponse>("/api/auth/login", {
        method: "POST",
        skipAuth: true,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
    });
}

/** ---- generic helpers for later phases (not wired anywhere yet) ---- */

export async function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "GET" });
}

export async function apiPost<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
): Promise<T> {
    const headers = new Headers(options?.headers);
    let payload: BodyInit | undefined;
    if (body !== undefined) {
        headers.set("Content-Type", "application/json");
        payload = JSON.stringify(body);
    }
    return request<T>(path, { ...options, method: "POST", headers, body: payload });
}