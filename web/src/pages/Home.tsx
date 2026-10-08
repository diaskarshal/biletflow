import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { EventCard, slotsLeft } from "../components/EventCard";
import { EventImage } from "../components/EventImage";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { useEvent } from "../hooks/useEvent";
import { errorMessage, formatDate, formatTime, priceLabel } from "../lib/format";
import type { components } from "../api/schema";

type EventOut = components["schemas"]["EventOut"];

export function Home() {
  const events = useInfiniteQuery({
    queryKey: ["events"],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await api.GET("/api/v1/events", {
        // The schema types the cursor as a number, the API returns a string.
        params: { query: { limit: 12, cursor: pageParam as unknown as number | undefined } },
      });
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const items = events.data?.pages.flatMap((p) => p.items) ?? [];
  const [hero, ...rest] = items;

  return (
    <div className="mx-auto max-w-6xl space-y-16 px-6 py-12">
      {events.isLoading && <Spinner />}
      {events.isError && <ErrorState message={errorMessage(events.error, "Could not load events")} />}
      {events.isSuccess && items.length === 0 && <EmptyState title="No events yet" />}
      {hero && <Hero event={hero} />}
      {rest.length > 0 && (
        <div className="grid grid-cols-3 gap-6">
          {rest.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
      {events.hasNextPage && (
        <div className="text-center">
          <Button variant="secondary" loading={events.isFetchingNextPage} onClick={() => events.fetchNextPage()}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

function Hero({ event }: { event: EventOut }) {
  const detail = useEvent(event.slug);
  const types = detail.data?.ticket_types.filter((t) => !t.is_hidden) ?? [];
  const slots = slotsLeft(event.capacity, types);
  const rows: [string, string][] = [
    ["Date", formatDate(event.starts_at, event.display_timezone)],
    ["Time", formatTime(event.starts_at, event.display_timezone)],
  ];
  if (detail.data) rows.push(["Slots", `${slots.left} / ${slots.total}`]);

  return (
    <section className="flex items-stretch gap-12">
      <div className="flex flex-1 flex-col">
        <h1 className="font-heading text-5xl">{event.title}</h1>
        {event.description && <p className="mt-6 line-clamp-3 text-2xl">{event.description}</p>}
        <dl className="mt-8 space-y-2 text-2xl">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {event.venue_address && <p className="mt-2 text-2xl">{event.venue_address}</p>}
        <Link
          to={`/events/${event.slug}`}
          className="mt-auto block rounded-2xl bg-brand py-4 text-center font-heading text-3xl text-on-brand"
        >
          {detail.data ? priceLabel(types.map((t) => t.price_kzt)) : "View event"}
        </Link>
      </div>
      <EventImage
        url={event.cover_image_url}
        title={event.title}
        className="aspect-[4/5] w-[40%] shrink-0 rounded-2xl"
      />
    </section>
  );
}
