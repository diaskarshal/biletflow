import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const token = localStorage.getItem("token");
    if (token && !request.headers.has("Authorization")) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    return request;
  },
};

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

async function fetchWithRefresh(request: Request): Promise<Response> {
  const retryCopy = request.clone(); // must clone BEFORE sending, the body can only be read once
  const response = await fetch(request);

  const isAuthEndpoint = request.url.includes("/api/v1/auth/");
  if (response.status !== 401 || isAuthEndpoint) return response;

  refreshing ??= refreshTokens().finally(() => {
    refreshing = null;
  });
  const refreshed = await refreshing;

  if (!refreshed) {
    window.dispatchEvent(new Event("auth:expired"));
    return response;
  }

  retryCopy.headers.set("Authorization", `Bearer ${localStorage.getItem("token")}`);
  return fetch(retryCopy);
}

export const api = createClient<paths>({ baseUrl, fetch: fetchWithRefresh });
api.use(authMiddleware);