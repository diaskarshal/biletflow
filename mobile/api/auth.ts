import { apiRequest } from "./client";

type RegisterData = {
    full_name: string;
    email: string;
    password: string;
};

type User = {
    id: number;
    email: string;
    full_name: string;
    email_verified_at: string | null;
};

export type LoginData = {
    email: string;
    password: string;
};

export type TokenResponse = {
    access_token: string;
    refresh_token: string;
    token_type: string;
};

export async function registerUser(data: RegisterData): Promise<User> {
    return apiRequest<User>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function loginUser(
    data: LoginData
): Promise<TokenResponse> {
    return apiRequest<TokenResponse>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function getCurrentUser(
    accessToken: string
): Promise<User> {
    return apiRequest<User>("/api/v1/me", {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
}