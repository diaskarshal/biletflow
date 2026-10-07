import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type Tokens = { access_token: string; refresh_token: string };

export function saveTokens(tokens: Tokens) {
    localStorage.setItem("access_token", tokens.access_token);
    localStorage.setItem("refresh_token", tokens.refresh_token);
}

export function clearSession() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth:logout"));
}

const unauthenticated = createClient<paths>({ baseUrl });

let refreshing: Promise<boolean> | null = null;

function refreshTokens(): Promise<boolean> {
    refreshing ??= (async () => {
        const refresh_token = localStorage.getItem("refresh_token");
        if (!refresh_token) return false;
        const { data } = await unauthenticated.POST("/api/v1/auth/refresh", {
            body: { refresh_token },
        });
        if (!data) return false;
        saveTokens(data);
        return true;
    })().finally(() => {
        refreshing = null;
    });
    return refreshing;
}

const originals = new Map<string, Request>();

const auth: Middleware = {
    onRequest({ request, id }) {
        const token = localStorage.getItem("access_token");
        if (token && !request.headers.has("Authorization")) {
            request.headers.set("Authorization", `Bearer ${token}`);
        }
        originals.set(id, request.clone());
        return request;
    },
    async onResponse({ response, id, schemaPath }) {
        const original = originals.get(id);
        originals.delete(id);
        if (response.status !== 401 || !original || schemaPath.startsWith("/api/v1/auth/")) {
            return response;
        }
        if (!(await refreshTokens())) {
            clearSession();
            return response;
        }
        original.headers.set("Authorization", `Bearer ${localStorage.getItem("access_token")}`);
        return fetch(original);
    },
    onError({ id }) {
        originals.delete(id);
    },
};

export const api = createClient<paths>({ baseUrl });
api.use(auth);
