import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
const REQUEST_TIMEOUT_MS = 15000;

// Backend error envelope: {"error": {"code": "...", "message": "...", "details": {}}}
// Screens should switch on `code`, not on the English message.
export class ApiError extends Error {
    code: string;
    status: number;

    constructor(code: string, message: string, status = 0) {
        super(message);
        this.name = "ApiError";
        this.code = code;
        this.status = status;
    }
}

export type TokenPair = {
    access_token: string;
    refresh_token: string;
};

export async function saveTokens(tokens: TokenPair) {
    await SecureStore.setItemAsync("access_token", tokens.access_token);
    await SecureStore.setItemAsync("refresh_token", tokens.refresh_token);
}

export async function clearTokens() {
    await SecureStore.deleteItemAsync("access_token");
    await SecureStore.deleteItemAsync("refresh_token");
}

export async function hasStoredTokens(): Promise<boolean> {
    return (await SecureStore.getItemAsync("access_token")) !== null;
}

// The session layer registers this so a rejected refresh token signs the user out.
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
    onSessionExpired = handler;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } catch {
        throw new ApiError(
            "NETWORK_ERROR",
            `Cannot reach the server (${API_URL}). Check your connection and that the backend is running.`
        );
    } finally {
        clearTimeout(timer);
    }
}

let refreshing: Promise<boolean> | null = null;

function refreshTokens(): Promise<boolean> {
    refreshing ??= (async () => {
        const refresh_token = await SecureStore.getItemAsync("refresh_token");
        if (!refresh_token) {
            onSessionExpired?.();
            return false;
        }

        let response: Response;
        try {
            response = await fetchWithTimeout(`${API_URL}/api/v1/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token }),
            });
        } catch {
            // Network problem, not a rejected token: keep the session so it can recover.
            return false;
        }

        if (!response.ok) {
            await clearTokens();
            onSessionExpired?.();
            return false;
        }

        await saveTokens(await response.json());
        return true;
    })().finally(() => {
        refreshing = null;
    });
    return refreshing;
}

// Empty bodies (204) and non-JSON responses (proxy error pages) come back as null.
async function readBody(response: Response): Promise<any> {
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function toApiError(response: Response, data: any): ApiError {
    const error = data?.error;
    if (!error) {
        return new ApiError(
            `HTTP_${response.status}`,
            `Server error (${response.status}). Please try again.`,
            response.status
        );
    }

    if (error.code === "VALIDATION_ERROR") {
        const first = error.details?.errors?.[0];
        const field = first?.loc?.[first.loc.length - 1];
        const message = first ? `${field}: ${first.msg}` : "Please check the entered details.";
        return new ApiError(error.code, message, response.status);
    }

    return new ApiError(error.code, error.message ?? "Request failed", response.status);
}

export async function apiRequest<T>(
    endpoint: string,
    options?: RequestInit,
    retry = true
): Promise<T> {
    const accessToken = await SecureStore.getItemAsync("access_token");

    const response = await fetchWithTimeout(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
            ...options?.headers,
        },
    });

    if (
        response.status === 401 &&
        retry &&
        !endpoint.startsWith("/api/v1/auth/") &&
        (await refreshTokens())
    ) {
        return apiRequest<T>(endpoint, options, false);
    }

    const data = await readBody(response);

    if (!response.ok) {
        throw toApiError(response, data);
    }

    return data as T;
}
