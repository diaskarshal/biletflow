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

export const api = createClient<paths>({ baseUrl });
api.use(authMiddleware);