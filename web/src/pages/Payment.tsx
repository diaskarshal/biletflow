import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { ErrorState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { errorMessage, formatPrice } from "../lib/format";
import { t, tOptional } from "../lib/i18n";

type Outcome = "success" | "failure" | "timeout";

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
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
        <ErrorState message={errorMessage(payment.error, t("pay.notFound"))} />
      </div>
    );
  }

  const p = payment.data;
  const back =
    p.purpose === "order"
      ? { to: "/tickets", label: t("pay.toTickets") }
      : { to: `/organizer/events/${p.event_id}`, label: t("pay.toEvent") };

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-bold sm:text-3xl">{t("pay.title")}</h1>
      <p className="border border-slate-400 p-3 text-sm font-semibold">
        {t("pay.notice")}
      </p>
      <table className="w-full break-words">
        <tbody>
          <Row k={t("pay.for")} v={t(p.purpose === "order" ? "pay.forTickets" : "pay.forActivation", { event: p.event_title })} />
          <Row k={t("pay.amount")} v={`${formatPrice(p.amount_kzt)} KZT`} />
          <Row k={t("pay.payment")} v={`#${p.id}`} />
        </tbody>
      </table>
      {p.status === "pending" ? (
        <div className="space-y-3">
          <p>{t("pay.choose")}</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => simulate.mutate("success")} loading={simulate.isPending}>
              {t("pay.success")}
            </Button>
            <Button variant="danger" onClick={() => simulate.mutate("failure")} disabled={simulate.isPending}>
              {t("pay.failure")}
            </Button>
            <Button variant="secondary" onClick={() => simulate.mutate("timeout")} disabled={simulate.isPending}>
              {t("pay.timeout")}
            </Button>
          </div>
          {simulate.isError && <ErrorState message={errorMessage(simulate.error, t("pay.failed"))} />}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-lg font-semibold">{tOptional(`pay.result.${p.status}`) ?? p.status}</p>
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
