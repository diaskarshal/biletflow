import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Button } from "../components/Button";

export function Home() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const { data, error } = await api.GET("/health");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="font-heading text-4xl font-bold text-slate-900">BiletFlow</h1>
      <p className="mt-2 text-slate-500">
        Self-service event ticketing for Kazakhstan.
      </p>

      <div className="mt-8 rounded-lg border border-slate-200 p-4 text-sm">
        {health.isLoading && <span className="text-slate-500">Checking API…</span>}
        {health.isError && <span className="text-red-600">API unreachable</span>}
        {health.data && (
          <span className="text-emerald-600">
            API status: {health.data.status} · DB: {health.data.db}
          </span>
        )}
      </div>

      <Button className="mt-8">Get Tickets</Button>
    </div>
  );
}
