import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { EventCard } from "../components/EventCard";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Spinner";
import { useEvent } from "../hooks/useEvent";
import { errorMessage } from "../lib/format";
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

  // Orders only carry event_id and the API has no get-event-by-id, so match against the public list.
  const events = useQuery({
    queryKey: ["events-by-id"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/events", { params: { query: { limit: 100 } } });
      if (error) throw error;
      return new Map(data.items.map((e) => [e.id, e]));
    },
  });

  if (orders.isLoading || events.isLoading) return <Spinner />;
  const failure = orders.error ?? events.error;
  const tickets = (orders.data ?? []).flatMap((o) => o.tickets.map((t) => ({ ticket: t, event: events.data?.get(o.event_id) })));

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <h1 className="font-heading text-5xl">My tickets</h1>
      {failure && <ErrorState message={errorMessage(failure, "Could not load tickets")} />}
      {!failure && tickets.length === 0 && <EmptyState title="No tickets yet">Get one from the Events page.</EmptyState>}
      <div className="grid grid-cols-3 gap-6">
        {tickets.map(({ ticket, event }) =>
          event ? <TicketCard key={ticket.id} ticket={ticket} event={event} onOpen={() => setShown(ticket)} /> : null,
        )}
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
  return <EventCard event={event} badge={badge} onClick={onOpen} />;
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
    </div>
  );
}
