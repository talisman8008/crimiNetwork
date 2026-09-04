// src/lib/api.ts

export const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('netra-auth-token');
  
  const headers = new Headers(options.headers);
  if (token) {
    // Strip quotes if they were saved by useLocalStorage
    const cleanToken = token.replace(/^"(.*)"$/, '$1');
    headers.set('Authorization', `Bearer ${cleanToken}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Dispatch a custom event that auth.tsx can listen to and clear state
    window.dispatchEvent(new Event('auth:unauthorized'));
    throw new ApiError(401, 'Unauthorized');
  }

  if (!response.ok) {
    let message = 'An error occurred';
    try {
      const data = await response.json();
      message = data.detail || data.error || message;
    } catch {
      message = response.statusText;
    }
    throw new ApiError(response.status, message);
  }

  // If response is 204 No Content, return null
  if (response.status === 204) return null as T;

  return response.json();
}
