import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { ErrorState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { errorMessage, formatPrice } from "../lib/format";

type Outcome = "success" | "failure" | "timeout";

const RESULT: Record<string, string> = {
  succeeded: "Payment completed.",
  failed: "Payment failed. Nothing was charged.",
  expired: "Payment timed out. Nothing was charged.",
};

export function Payment() {
  const id = Number(useParams().id);
  const queryClient = useQueryClient();

  const payment = useQuery({
    queryKey: ["payment", id],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/payments/{payment_id}", {
        params: { path: { payment_id: id } },
      });
      if (error) throw error;
      return data;
    },
  });

  const simulate = useMutation({
    mutationFn: async (outcome: Outcome) => {
      const { data, error } = await api.POST("/api/v1/payments/{payment_id}/simulate", {
        params: { path: { payment_id: id } },
        body: { outcome },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["payment", id], data);
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      queryClient.invalidateQueries({ queryKey: ["activation", data.event_id] });
    },
  });

  if (payment.isLoading) return <Spinner />;
  if (!payment.data) {
    return (
      <div className="mx-auto max-w-xl px-6 py-12">
        <ErrorState message={errorMessage(payment.error, "Payment not found")} />
      </div>
    );
  }

  const p = payment.data;
  const back =
    p.purpose === "order"
      ? { to: "/tickets", label: "Go to My tickets" }
      : { to: `/organizer/events/${p.event_id}`, label: "Back to the event" };

  return (
    <div className="mx-auto max-w-xl space-y-6 px-6 py-12">
      <h1 className="text-3xl font-bold">Test payment</h1>
      <p className="border border-slate-400 p-3 text-sm font-semibold">
        This is a simulated payment provider for the BiletFlow demo. No real money is charged.
      </p>
      <table className="w-full">
        <tbody>
          <Row k="For" v={p.purpose === "order" ? `Tickets for ${p.event_title}` : `Paid sales activation for ${p.event_title}`} />
          <Row k="Amount" v={`${formatPrice(p.amount_kzt)} KZT`} />
          <Row k="Payment" v={`#${p.id}`} />
        </tbody>
      </table>
      {p.status === "pending" ? (
        <div className="space-y-3">
          <p>Choose what the payment provider should answer:</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => simulate.mutate("success")} loading={simulate.isPending}>
              Success
            </Button>
            <Button variant="danger" onClick={() => simulate.mutate("failure")} disabled={simulate.isPending}>
              Failure
            </Button>
            <Button variant="secondary" onClick={() => simulate.mutate("timeout")} disabled={simulate.isPending}>
              Timeout
            </Button>
          </div>
          {simulate.isError && <ErrorState message={errorMessage(simulate.error, "Could not complete the payment")} />}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-lg font-semibold">{RESULT[p.status] ?? `Payment ${p.status}.`}</p>
          <Link to={back.to} className="underline">
            {back.label}
          </Link>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr className="border-b border-slate-300">
      <th className="py-2 pr-4 text-left font-semibold">{k}</th>
      <td className="py-2">{v}</td>
    </tr>
  );
}
