import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { errorMessage, formatDate, formatPrice, formatTime, refundPolicyLabel } from "../lib/format";
import { t } from "../lib/i18n";
import { Button } from "./Button";
import { ErrorState } from "./EmptyState";
import { Input } from "./Input";
import { Modal } from "./Modal";
import type { components } from "../api/schema";

type Event = components["schemas"]["EventOut"];
type TicketType = components["schemas"]["TicketTypeOut"];
type Promo = components["schemas"]["PromoPreview"];

function discountFor(promo: Promo | null, ticketType: TicketType) {
  if (!promo || (promo.ticket_type_ids && !promo.ticket_type_ids.includes(ticketType.id))) return 0;
  return promo.discount_type === "percent"
    ? Math.floor((ticketType.price_kzt * promo.discount_value) / 100)
    : Math.min(promo.discount_value, ticketType.price_kzt);
}

export function CheckoutModal({
  event,
  ticketType,
  promo: initialPromo,
  onClose,
}: {
  event: Event;
  ticketType: TicketType;
  promo: Promo | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [code, setCode] = useState(initialPromo?.code ?? "");
  const [promo, setPromo] = useState<Promo | null>(initialPromo);

  const check = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.GET("/api/v1/events/{event_id}/promo", {
        params: { path: { event_id: event.id }, query: { code } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: setPromo,
    onError: () => setPromo(null),
  });

  const order = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/api/v1/orders", {
        // A fresh key per attempt: retries of one click are deduplicated by the server, edits are not.
        params: { header: { "Idempotency-Key": crypto.randomUUID() } },
        body: {
          event_id: event.id,
          items: [{ ticket_type_id: ticketType.id, quantity: 1, attendees: [{ name, email }] }],
          promo_code: promo?.code ?? null,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["event", event.slug] });
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      if (data.payment_id) navigate(`/pay/${data.payment_id}`);
    },
  });

  const price = ticketType.price_kzt === 0 ? t("common.free") : `${formatPrice(ticketType.price_kzt)} KZT`;
  const discount = discountFor(promo, ticketType);

  return (
    <Modal onClose={onClose} label={t("checkout.title")}>
      {order.isSuccess ? (
        <div className="space-y-6">
          <h2 className="font-heading text-2xl sm:text-3xl">{t("checkout.issued")}</h2>
          <p>{t("checkout.ready", { type: ticketType.name, event: event.title })}</p>
          <Link to="/tickets" className="block rounded-xl bg-brand py-3 text-center font-heading text-on-brand">
            {t("checkout.viewTickets")}
          </Link>
        </div>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            order.mutate();
          }}
        >
          <h2 className="font-heading text-2xl sm:text-3xl">{t("checkout.title")}</h2>
          <dl className="space-y-1">
            <div className="font-heading">{event.title}</div>
            <Row k={t("common.date")} v={formatDate(event.starts_at, event.display_timezone)} />
            <Row k={t("common.time")} v={formatTime(event.starts_at, event.display_timezone)} />
            {event.venue_address && <div className="font-heading">{event.venue_address}</div>}
            <div className="pt-3" />
            <Row k={t("checkout.ticketType")} v={ticketType.name} />
            <Row k={t("checkout.price")} v={price} />
            {discount > 0 && <Row k={t("checkout.promo", { code: promo?.code ?? "" })} v={`-${formatPrice(discount)} KZT`} />}
            {discount > 0 && <Row k={t("checkout.total")} v={`${formatPrice(ticketType.price_kzt - discount)} KZT`} />}
            <Row k={t("checkout.refunds")} v={refundPolicyLabel(event.refund_policy)} />
          </dl>
          <label className="block space-y-1">
            <span className="font-heading text-sm">{t("checkout.attendeeName")}</span>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="font-heading text-sm">{t("checkout.attendeeEmail")}</span>
            <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {ticketType.price_kzt > 0 && (
            <div className="space-y-1">
              <label htmlFor="promo-code" className="block font-heading text-sm">
                {t("checkout.promoCode")}
              </label>
              <div className="flex gap-2">
                <Input id="promo-code" value={code} onChange={(e) => setCode(e.target.value)} />
                <Button type="button" variant="secondary" disabled={!code} loading={check.isPending} onClick={() => check.mutate()}>
                  {t("checkout.apply")}
                </Button>
              </div>
              {check.isError && <ErrorState message={errorMessage(check.error, t("checkout.promoFailed"))} />}
              {promo && discount === 0 && <p className="text-sm">{t("checkout.promoNotApplicable")}</p>}
            </div>
          )}
          {order.isError && <ErrorState message={errorMessage(order.error, t("checkout.failed"))} />}
          <Button type="submit" loading={order.isPending} className="w-full py-3">
            {ticketType.price_kzt === 0 ? t("checkout.confirm") : t("checkout.toPayment")}
          </Button>
        </form>
      )}
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="font-heading">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
