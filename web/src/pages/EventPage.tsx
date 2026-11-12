import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { CheckoutModal } from "../components/CheckoutModal";
import { slotsLeft } from "../components/EventCard";
import { EventImage } from "../components/EventImage";
import { ErrorState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../hooks/useEvent";
import { errorMessage, formatDate, formatPrice, formatTime, refundPolicyLabel } from "../lib/format";
import { t } from "../lib/i18n";
import type { components } from "../api/schema";

type TicketType = components["schemas"]["TicketTypeOut"];

// Why a ticket type can't be bought right now, or null if it can.
function unavailableReason(ticket: TicketType, eventCancelled: boolean, paidSalesEnabled: boolean) {
  if (eventCancelled) return t("event.reasonCancelled");
  if (ticket.price_kzt > 0 && !paidSalesEnabled) return t("event.reasonNotOnSale");
  if (ticket.quantity_total - ticket.quantity_sold - ticket.quantity_reserved <= 0) return t("event.reasonSoldOut");
  const now = Date.now();
  if (ticket.sales_start_at && new Date(ticket.sales_start_at).getTime() > now) return t("event.reasonNotOnSale");
  if (ticket.sales_end_at && new Date(ticket.sales_end_at).getTime() < now) return t("event.reasonClosed");
  return null;
}

export function EventPage() {
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const event = useEvent(slug);
  const [selected, setSelected] = useState<TicketType | null>(null);
  const [params] = useSearchParams();
  const token = params.get("promo");
  const promo = useQuery({
    queryKey: ["promo", event.data?.id, token],
    enabled: !!token && !!event.data,
    retry: false,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/events/{event_id}/promo", {
        params: { path: { event_id: event.data!.id }, query: { token } },
      });
      if (error) throw error;
      return data;
    },
  });

  if (event.isLoading) return <Spinner />;
  if (event.isError || !event.data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <ErrorState message={errorMessage(event.error, t("event.notFound"))} />
      </div>
    );
  }

  const e = event.data;
  const types = e.ticket_types.filter((t) => !t.is_hidden);
  const slots = slotsLeft(types);
  const cancelled = e.status === "cancelled";

  function choose(t: TicketType) {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/events/${slug}${token ? `?promo=${token}` : ""}`)}`);
      return;
    }
    setSelected(t);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-10 md:flex-row">
        <EventImage url={e.cover_image_url} title={e.title} className="mx-auto aspect-[4/5] w-full max-w-sm shrink-0 rounded-2xl md:mx-0 md:w-[38%] md:max-w-none" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="break-words font-heading text-3xl sm:text-5xl">{e.title}</h1>
          <dl className="mt-4 space-y-1 text-lg sm:text-2xl">
            <Row k={t("common.date")} v={formatDate(e.starts_at, e.display_timezone)} />
            <Row k={t("common.time")} v={formatTime(e.starts_at, e.display_timezone)} />
            <Row k={t("common.slots")} v={`${slots.left} / ${slots.total}`} />
          </dl>
          {e.venue_address && <p className="mt-1 text-lg sm:text-2xl">{e.venue_address}</p>}
          {cancelled && <p className="mt-4 font-heading text-xl text-red-700">{t("event.cancelled")}</p>}
          {e.review_status !== "approved" && (
            <p className="mt-4 border border-slate-400 p-2">{t("event.notPublic")}</p>
          )}
          {promo.data && (
            <p className="mt-4 border border-brand p-2">
              {t("event.promoApplied", {
                code: promo.data.code,
                discount:
                  promo.data.discount_type === "percent"
                    ? t("event.percentOff", { value: promo.data.discount_value })
                    : t("event.amountOff", { value: formatPrice(promo.data.discount_value) }),
              })}
            </p>
          )}
          {promo.isError && <p className="mt-4 text-red-700">{errorMessage(promo.error, t("event.promoInvalid"))}</p>}
          <div className="mt-auto grid grid-cols-2 gap-3 pt-8 sm:gap-5 lg:grid-cols-3">
            {types.map((tt) => {
              const reason = unavailableReason(tt, cancelled, e.paid_sales_enabled);
              return (
                <button
                  key={tt.id}
                  type="button"
                  disabled={reason !== null}
                  onClick={() => choose(tt)}
                  className="rounded-2xl bg-brand px-3 py-4 font-heading text-lg sm:text-xl text-on-brand transition hover:bg-brand-dark disabled:opacity-50"
                >
                  <div>{tt.name}</div>
                  <div>{reason ?? (tt.price_kzt === 0 ? t("common.free") : formatPrice(tt.price_kzt))}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {e.description && <p className="mt-8 whitespace-pre-line text-lg sm:text-2xl">{e.description}</p>}
      <p className="mt-6">{t("event.refundPolicy", { policy: refundPolicyLabel(e.refund_policy) })}</p>
      <p className="mt-2">
        <Link className="underline" to={`/support/new?event_id=${e.id}`}>
          {t("event.contact")}
        </Link>
      </p>
      <ReportEvent eventId={e.id} />
      {selected && (
        <CheckoutModal event={e} ticketType={selected} promo={promo.data ?? null} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function ReportEvent({ eventId }: { eventId: number }) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const report = useMutation({
    mutationFn: async () => {
      const { error } = await api.POST("/api/v1/events/{event_id}/report", {
        params: { path: { event_id: eventId } },
        body: { reason },
      });
      if (error) throw error;
    },
  });
  if (!user) return null;
  if (report.isSuccess) return <p className="mt-2">{t("report.thanks")}</p>;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer underline">{t("report.open")}</summary>
      <form
        className="mt-2 max-w-xl space-y-2"
        onSubmit={(ev) => {
          ev.preventDefault();
          report.mutate();
        }}
      >
        <textarea
          required
          rows={3}
          maxLength={2000}
          aria-label={t("report.placeholder")}
          placeholder={t("report.placeholder")}
          className="w-full border border-slate-400 px-3 py-2"
          value={reason}
          onChange={(ev) => setReason(ev.target.value)}
        />
        {report.isError && <ErrorState message={errorMessage(report.error, t("report.failed"))} />}
        <Button type="submit" variant="secondary" loading={report.isPending}>
          {t("report.send")}
        </Button>
      </form>
    </details>
  );
}
