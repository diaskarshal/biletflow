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
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <h1 className="font-heading text-5xl">My tickets</h1>
      {orders.isError && <ErrorState message={errorMessage(orders.error, "Could not load tickets")} />}
      {awaiting.map((o) => (
        <p key={o.id} className="border border-slate-400 p-3">
          Order #{o.id} for {o.event.title} ({formatPrice(o.total_kzt)} KZT) is waiting for payment.{" "}
          <Link to={`/pay/${o.payment_id}`} className="font-semibold underline">
            Complete payment
          </Link>
        </p>
      ))}
      {orders.isSuccess && tickets.length === 0 && <EmptyState title="No tickets yet">Get one from the Events page.</EmptyState>}
      <div className="grid grid-cols-3 gap-6">
        {tickets.map(({ ticket, event }) => (
          <TicketCard key={ticket.id} ticket={ticket} event={event} onOpen={() => setShown(ticket)} />
        ))}
      </div>
      {shown && (
        <Modal onClose={() => setShown(null)} label="Ticket QR code">
          <QrCode ticket={shown} />
        </Modal>
      )}
    </div>
  );
}

function TicketCard({ ticket, event, onOpen }: { ticket: Ticket; event: EventOut; onOpen: () => void }) {
  const detail = useEvent(event.slug);
  const type = detail.data?.ticket_types.find((t) => t.id === ticket.ticket_type_id)?.name ?? "Ticket";
  const badge = ticket.status === "valid" ? type : `${type} · ${ticket.status.replace(/_/g, " ")}`;
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
      <h2 className="font-heading text-3xl">{ticket.attendee_name}</h2>
      {qr.isLoading && <Spinner />}
      {qr.isError && <ErrorState message="Could not load the QR code" />}
      {qr.data && <img src={qr.data} alt="Ticket QR code" className="mx-auto w-64 rounded-xl bg-white p-3" />}
      <p className="text-sm">Show this code at the entrance.</p>
      <Button variant="secondary" onClick={() => downloadPdf(ticket.id)}>
        Download PDF
      </Button>
      <p>
        <Link className="underline" to={`/support/new?ticket_id=${ticket.id}`}>
          Get help with this ticket
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
