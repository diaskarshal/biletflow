import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckoutModal } from "../components/CheckoutModal";
import { slotsLeft } from "../components/EventCard";
import { EventImage } from "../components/EventImage";
import { ErrorState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../hooks/useEvent";
import { errorMessage, formatDate, formatPrice, formatTime } from "../lib/format";
import type { components } from "../api/schema";

type TicketType = components["schemas"]["TicketTypeOut"];

// Why a ticket type can't be bought right now, or null if it can.
function unavailableReason(t: TicketType, eventCancelled: boolean) {
  if (eventCancelled) return "Cancelled";
  if (t.quantity_total - t.quantity_sold - t.quantity_reserved <= 0) return "Sold out";
  const now = Date.now();
  if (t.sales_start_at && new Date(t.sales_start_at).getTime() > now) return "Not on sale yet";
  if (t.sales_end_at && new Date(t.sales_end_at).getTime() < now) return "Sales closed";
  return null;
}

export function EventPage() {
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const event = useEvent(slug);
  const [selected, setSelected] = useState<TicketType | null>(null);

  if (event.isLoading) return <Spinner />;
  if (event.isError || !event.data) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <ErrorState message={errorMessage(event.error, "Event not found")} />
      </div>
    );
  }

  const e = event.data;
  const types = e.ticket_types.filter((t) => !t.is_hidden);
  const slots = slotsLeft(e.capacity, types);
  const cancelled = e.status === "cancelled";

  function choose(t: TicketType) {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/events/${slug}`)}`);
      return;
    }
    setSelected(t);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex gap-10">
        <EventImage url={e.cover_image_url} title={e.title} className="aspect-[4/5] w-[38%] shrink-0 rounded-2xl" />
        <div className="flex flex-1 flex-col">
          <h1 className="font-heading text-5xl">{e.title}</h1>
          <dl className="mt-4 space-y-1 text-2xl">
            <Row k="Date" v={formatDate(e.starts_at, e.display_timezone)} />
            <Row k="Time" v={formatTime(e.starts_at, e.display_timezone)} />
            <Row k="Slots" v={`${slots.left} / ${slots.total}`} />
          </dl>
          {e.venue_address && <p className="mt-1 text-2xl">{e.venue_address}</p>}
          {cancelled && <p className="mt-4 font-heading text-xl text-red-700">This event was cancelled.</p>}
          <div className="mt-auto grid grid-cols-3 gap-5 pt-8">
            {types.map((t) => {
              const reason = unavailableReason(t, cancelled);
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={reason !== null}
                  onClick={() => choose(t)}
                  className="rounded-2xl bg-brand px-3 py-4 font-heading text-xl text-on-brand transition hover:bg-brand-dark disabled:opacity-50"
                >
                  <div>{t.name}</div>
                  <div>{reason ?? (t.price_kzt === 0 ? "Free" : formatPrice(t.price_kzt))}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {e.description && <p className="mt-8 whitespace-pre-line text-2xl">{e.description}</p>}
      {selected && <CheckoutModal event={e} ticketType={selected} onClose={() => setSelected(null)} />}
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
