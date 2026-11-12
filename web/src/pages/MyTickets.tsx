import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { EventCard } from "../components/EventCard";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Spinner";
import { useEvent } from "../hooks/useEvent";
import { downloadBlob } from "../lib/download";
import { errorMessage, formatPrice } from "../lib/format";
import { t, tOptional } from "../lib/i18n";
import type { components } from "../api/schema";

type Ticket = components["schemas"]["TicketOut"];
type EventOut = components["schemas"]["EventOut"];

export function MyTickets() {
  const [shown, setShown] = useState<Ticket | null>(null);

  const orders = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/me/orders");
      if (error) throw error;
      return data;
    },
  });

  if (orders.isLoading) return <Spinner />;
  const all = orders.data ?? [];
  const awaiting = all.filter((o) => o.status === "pending" && o.payment_id);
  const tickets = all
    .filter((o) => ["paid", "cancelled", "refunded"].includes(o.status))
    .flatMap((o) => o.tickets.map((t) => ({ ticket: t, event: o.event })));

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="font-heading text-3xl sm:text-5xl">{t("nav.tickets")}</h1>
      {orders.isError && <ErrorState message={errorMessage(orders.error, t("tickets.loadFailed"))} />}
      {awaiting.map((o) => (
        <p key={o.id} className="border border-slate-400 p-3">
          {t("tickets.awaiting", { id: o.id, event: o.event.title, amount: formatPrice(o.total_kzt) })}{" "}
          <Link to={`/pay/${o.payment_id}`} className="font-semibold underline">
            {t("tickets.completePayment")}
          </Link>
        </p>
      ))}
      {orders.isSuccess && tickets.length === 0 && <EmptyState title={t("tickets.empty")}>{t("tickets.emptyHint")}</EmptyState>}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tickets.map(({ ticket, event }) => (
          <TicketCard key={ticket.id} ticket={ticket} event={event} onOpen={() => setShown(ticket)} />
        ))}
      </div>
      {shown && (
        <Modal onClose={() => setShown(null)} label={t("tickets.qrLabel")}>
          <QrCode ticket={shown} />
        </Modal>
      )}
    </div>
  );
}

function TicketCard({ ticket, event, onOpen }: { ticket: Ticket; event: EventOut; onOpen: () => void }) {
  const detail = useEvent(event.slug);
  const type = detail.data?.ticket_types.find((t) => t.id === ticket.ticket_type_id)?.name ?? t("tickets.ticket");
  const status = tOptional(`tickets.status.${ticket.status}`) ?? ticket.status.replace(/_/g, " ");
  const badge = ticket.status === "valid" ? type : `${type} · ${status}`;
  return <EventCard event={event} badge={badge} status={event.status} onClick={onOpen} />;
}

function QrCode({ ticket }: { ticket: Ticket }) {
  // The QR endpoint needs the bearer token, so a plain <img src> won't work: fetch as a blob.
  const qr = useQuery({
    queryKey: ["ticket-qr", ticket.id],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/tickets/{ticket_id}/qr", {
        params: { path: { ticket_id: ticket.id } },
        parseAs: "blob",
      });
      if (error) throw error;
      return URL.createObjectURL(data as Blob);
    },
    staleTime: Infinity,
  });

  return (
    <div className="space-y-4 text-center">
      <h2 className="font-heading text-2xl sm:text-3xl">{ticket.attendee_name}</h2>
      {qr.isLoading && <Spinner />}
      {qr.isError && <ErrorState message={t("tickets.qrFailed")} />}
      {qr.data && <img src={qr.data} alt={t("tickets.qrLabel")} className="mx-auto w-full max-w-64 rounded-xl bg-white p-3" />}
      <p className="text-sm">{t("tickets.showAtEntrance")}</p>
      <Button variant="secondary" onClick={() => downloadPdf(ticket.id)}>
        {t("tickets.downloadPdf")}
      </Button>
      <p>
        <Link className="underline" to={`/support/new?ticket_id=${ticket.id}`}>
          {t("tickets.help")}
        </Link>
      </p>
    </div>
  );
}

async function downloadPdf(ticketId: number) {
  const { data } = await api.GET("/api/v1/tickets/{ticket_id}/pdf", {
    params: { path: { ticket_id: ticketId } },
    parseAs: "blob",
  });
  if (data) downloadBlob(data as Blob, `ticket-${ticketId}.pdf`);
}
