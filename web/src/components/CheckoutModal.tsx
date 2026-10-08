import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { errorMessage, formatDate, formatPrice, formatTime } from "../lib/format";
import { Button } from "./Button";
import { ErrorState } from "./EmptyState";
import { Input } from "./Input";
import { Modal } from "./Modal";
import type { components } from "../api/schema";

type Event = components["schemas"]["EventOut"];
type TicketType = components["schemas"]["TicketTypeOut"];

export function CheckoutModal({ event, ticketType, onClose }: { event: Event; ticketType: TicketType; onClose: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  const order = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/api/v1/orders", {
        // A fresh key per attempt: retries of one click are deduplicated by the server, edits are not.
        params: { header: { "Idempotency-Key": crypto.randomUUID() } },
        body: {
          event_id: event.id,
          items: [{ ticket_type_id: ticketType.id, quantity: 1, attendees: [{ name, email }] }],
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", event.slug] });
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
    },
  });

  const price = ticketType.price_kzt === 0 ? "Free" : `${formatPrice(ticketType.price_kzt)} KZT`;

  return (
    <Modal onClose={onClose} label="Checkout">
      {order.isSuccess ? (
        <div className="space-y-6">
          <h2 className="font-heading text-3xl">Ticket issued</h2>
          <p>Your {ticketType.name} ticket for {event.title} is ready.</p>
          <Link to="/tickets" className="block rounded-xl bg-brand py-3 text-center font-heading text-on-brand">
            View my tickets
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
          <h2 className="font-heading text-3xl">Checkout</h2>
          <dl className="space-y-1">
            <div className="font-heading">{event.title}</div>
            <Row k="Date" v={formatDate(event.starts_at, event.display_timezone)} />
            <Row k="Time" v={formatTime(event.starts_at, event.display_timezone)} />
            {event.venue_address && <div className="font-heading">{event.venue_address}</div>}
            <div className="pt-3" />
            <Row k="Ticket type" v={ticketType.name} />
            <Row k="Price" v={price} />
          </dl>
          <label className="block space-y-1">
            <span className="font-heading text-sm">Attendee name</span>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="font-heading text-sm">Attendee email</span>
            <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {order.isError && <ErrorState message={errorMessage(order.error, "Could not complete the order")} />}
          <Button type="submit" loading={order.isPending} className="w-full py-3">
            {ticketType.price_kzt === 0 ? "Confirm registration" : "Confirm and Proceed to Payment"}
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
