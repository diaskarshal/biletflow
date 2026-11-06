import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { EventCard } from "../components/EventCard";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { errorMessage } from "../lib/format";

const FEED_ID = "events";

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

  return (
    <>
      <Hero />
      <section id={FEED_ID} className="mx-auto max-w-6xl scroll-mt-6 space-y-16 px-4 py-8 sm:px-6 sm:py-12">
        {events.isLoading && <Spinner />}
        {events.isError && <ErrorState message={errorMessage(events.error, "Could not load events")} />}
        {events.isSuccess && items.length === 0 && <EmptyState title="No events yet" />}
        {items.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((e) => (
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
      </section>
    </>
  );
}

const linkClass = "text-accent underline underline-offset-8 hover:decoration-4";

// Fills the first screen under the nav, so the feed starts below the fold.
function Hero() {
  function scrollToFeed(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(FEED_ID)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <section className="mx-auto flex min-h-[calc(100svh-4.5rem)] max-w-6xl flex-col justify-center px-4 sm:px-6">
      <h1 className="font-heading text-6xl font-bold sm:text-8xl">BiletFlow</h1>
      <p className="mt-8 font-heading text-3xl leading-snug sm:text-5xl">
        Start{" "}
        <a href={`#${FEED_ID}`} onClick={scrollToFeed} className={linkClass}>
          browsing events
        </a>
        ,
        <br />
        Or{" "}
        {/* RequireAuth sends guests to login and back here afterwards. */}
        <Link to="/organizer/events/new" className={linkClass}>
          start your own event
        </Link>{" "}
        now
      </p>
    </section>
  );
}
