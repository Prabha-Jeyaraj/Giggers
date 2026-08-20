const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? 'https://gigg-client-backend.onrender.com'
    : 'http://localhost:4000');

function getToken(): string | null {
  try {
    // Must match authStore's persist storage (sessionStorage) — each tab
    // keeps its own session, so the token has to come from the same
    // per-tab store the auth state itself lives in.
    const raw = sessionStorage.getItem('giggers-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token || null;
  } catch {
    return null;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const token = getToken();
  const res = await fetch(url.toString(), {
    method,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`) as Error & { data?: unknown; status?: number };
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, params?: Record<string, string>) =>
    request<T>('GET', path, undefined, params),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
