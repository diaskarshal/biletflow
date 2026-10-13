import { apiRequest, clearTokens, saveTokens } from "./client";
import type { TokenPair } from "./client";

type RegisterData = {
    full_name: string;
    email: string;
    password: string;
};

export type User = {
    id: number;
    email: string;
    full_name: string;
    email_verified_at: string | null;
};

export type LoginData = {
    email: string;
    password: string;
};

export type TokenResponse = TokenPair & {
    token_type: string;
};

export async function registerUser(data: RegisterData): Promise<User> {
    return apiRequest<User>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function getCurrentUser(): Promise<User> {
    return apiRequest<User>("/api/v1/me");
}

// Logs in, stores the tokens securely, and returns the signed-in user.
export async function loginUser(data: LoginData): Promise<User> {
    const tokens = await apiRequest<TokenResponse>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
    });
    await saveTokens(tokens);
    return getCurrentUser();
}

// Server-side logout is a no-op today (stateless JWTs), so it is best-effort:
// the local tokens are always cleared even if the request fails.
export async function logoutUser(): Promise<void> {
    try {
        await apiRequest<void>("/api/v1/auth/logout", { method: "POST" });
    } catch {
        // ignore: signing out locally is what matters
    } finally {
        await clearTokens();
    }
}
