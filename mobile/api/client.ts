import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export async function clearTokens() {
    await SecureStore.deleteItemAsync("access_token");
    await SecureStore.deleteItemAsync("refresh_token");
}

let refreshing: Promise<boolean> | null = null;

function refreshTokens(): Promise<boolean> {
    refreshing ??= (async () => {
        const refresh_token = await SecureStore.getItemAsync("refresh_token");
        if (!refresh_token) return false;

        const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token }),
        });
        if (!response.ok) {
            await clearTokens();
            return false;
        }

        const tokens = await response.json();
        await SecureStore.setItemAsync("access_token", tokens.access_token);
        await SecureStore.setItemAsync("refresh_token", tokens.refresh_token);
        return true;
    })().finally(() => {
        refreshing = null;
    });
    return refreshing;
}

export async function apiRequest<T>(
    endpoint: string,
    options?: RequestInit,
    retry = true
): Promise<T> {
    const accessToken = await SecureStore.getItemAsync("access_token");

    const response = await fetch(`${API_URL}${endpoint}`, {
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

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? JSON.stringify(data));
    }

    return data;
}
