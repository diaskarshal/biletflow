import { afterEach, beforeEach, expect, it, vi } from "vitest";

const me = { id: 1, email: "a@test.kz", full_name: "A", email_verified_at: null };

let calls: string[];

function stubBackend(refreshOk: boolean) {
    vi.stubGlobal("fetch", vi.fn(async (input: Request) => {
        const path = new URL(input.url).pathname;
        const auth = input.headers.get("Authorization");
        calls.push(`${path} ${auth}`);
        if (path === "/api/v1/auth/refresh") {
            return refreshOk
                ? Response.json({ access_token: "new", refresh_token: "r2", token_type: "bearer" })
                : Response.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
        }
        if (auth === "Bearer new") return Response.json(me);
        return Response.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
    }));
}

beforeEach(() => {
    calls = [];
    vi.resetModules();
    localStorage.setItem("access_token", "old");
    localStorage.setItem("refresh_token", "r1");
    localStorage.setItem("user", JSON.stringify(me));
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    localStorage.clear();
});

it("uses the website origin for production API requests and uploaded images", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_API_URL", "");
    const { baseUrl, mediaUrl } = await import("./client");
    expect(baseUrl).toBe(window.location.origin);
    expect(mediaUrl("https://images.example.com/cover.jpg")).toBe("https://images.example.com/cover.jpg");
});

it("allows an explicit API origin without a trailing slash", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com/");
    const { baseUrl, mediaUrl } = await import("./client");
    expect(baseUrl).toBe("https://api.example.com");
    expect(mediaUrl("/uploads/cover.jpg")).toBe("https://api.example.com/uploads/cover.jpg");
});

it("refreshes on 401 and retries with the new token", async () => {
    stubBackend(true);
    const { api } = await import("./client");

    const { data } = await api.GET("/api/v1/me");

    expect(data?.full_name).toBe("A");
    expect(localStorage.getItem("access_token")).toBe("new");
    expect(localStorage.getItem("refresh_token")).toBe("r2");
    expect(calls).toEqual([
        "/api/v1/me Bearer old",
        "/api/v1/auth/refresh null",
        "/api/v1/me Bearer new",
    ]);
});

it("logs out when refresh fails", async () => {
    stubBackend(false);
    const loggedOut = vi.fn();
    window.addEventListener("auth:logout", loggedOut);
    const { api } = await import("./client");

    const { response } = await api.GET("/api/v1/me");

    expect(response.status).toBe(401);
    expect(loggedOut).toHaveBeenCalledOnce();
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    window.removeEventListener("auth:logout", loggedOut);
});
