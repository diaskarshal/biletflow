import { Link } from "react-router-dom";
import { useEvent } from "../hooks/useEvent";
import { formatDate, formatTime, priceLabel } from "../lib/format";
import { EventImage } from "./EventImage";
import type { components } from "../api/schema";

type EventOut = components["schemas"]["EventOut"];

export function slotsLeft(
  capacity: number | null,
  ticketTypes: { quantity_total: number; quantity_sold: number; quantity_reserved: number }[],
) {
  const taken = ticketTypes.reduce((n, t) => n + t.quantity_sold + t.quantity_reserved, 0);
  const total = capacity ?? ticketTypes.reduce((n, t) => n + t.quantity_total, 0);
  return { left: Math.max(total - taken, 0), total };
}

// `badge` replaces the price label (My tickets shows the ticket type instead).
// `status` (organizer view) is shown next to the price when the event is not published.
export function EventCard({
  event,
  badge,
  status,
  onClick,
}: {
  event: EventOut;
  badge?: string;
  status?: string;
  onClick?: () => void;
}) {
  // The list endpoint has no prices or ticket counts, so each card loads the detail (cached, shared with the event page).
  const detail = useEvent(event.slug);
  const types = detail.data?.ticket_types.filter((t) => !t.is_hidden) ?? [];
  const slots = slotsLeft(event.capacity, types);
  const price = badge ?? (detail.data ? priceLabel(types.map((t) => t.price_kzt)) : "...");
  const label = status && status !== "published" ? `${status} · ${price}` : price;

  const body = (
    <>
      <EventImage url={event.cover_image_url} title={event.title} className="h-full w-2/5 shrink-0" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-heading text-xl text-brand">{event.title}</h3>
        <dl className="space-y-0.5 text-sm">
          <Row k="Date" v={formatDate(event.starts_at, event.display_timezone)} />
          <Row k="Time" v={formatTime(event.starts_at, event.display_timezone)} />
          {detail.data && <Row k="Slots" v={`${slots.left} / ${slots.total}`} />}
        </dl>
        {event.venue_address && <p className="truncate text-sm">{event.venue_address}</p>}
        <span className="mt-auto rounded-xl bg-brand py-1.5 text-center font-heading text-on-brand">{label}</span>
      </div>
    </>
  );
  const cls = "flex h-60 w-full overflow-hidden rounded-2xl bg-sky text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  ) : (
    <Link to={`/events/${event.slug}`} className={cls}>
      {body}
    </Link>
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
