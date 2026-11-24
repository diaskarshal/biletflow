import { useEffect, useState } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { EventCard } from "../components/EventCard";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Input } from "../components/Input";
import { Spinner } from "../components/Spinner";
import { errorMessage } from "../lib/format";
import { t } from "../lib/i18n";

const FEED_ID = "events";

export function Home() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const events = useInfiniteQuery({
    queryKey: ["events", q],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await api.GET("/api/v1/events", {
        params: { query: { limit: 12, cursor: pageParam as unknown as number | undefined, q: q || undefined } },
      });
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    placeholderData: keepPreviousData,
  });

  const items = events.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <Hero />
      <section id={FEED_ID} className="mx-auto max-w-6xl scroll-mt-6 space-y-8 px-4 py-8 sm:px-6 sm:py-12">
        <Input
          type="search"
          aria-label={t("home.search")}
          placeholder={t("home.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        {events.isLoading && <Spinner />}
        {events.isError && <ErrorState message={errorMessage(events.error, t("home.loadFailed"))} />}
        {events.isSuccess && items.length === 0 && <EmptyState title={t(q ? "home.noMatch" : "home.empty")} />}
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
              {t("home.loadMore")}
            </Button>
          </div>
        )}
      </section>
    </>
  );
}

const linkClass = "text-accent underline underline-offset-8 hover:decoration-4";

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
        {t("home.before1")}
        <a href={`#${FEED_ID}`} onClick={scrollToFeed} className={linkClass}>
          {t("home.link1")}
        </a>
        {t("home.after1")}
        <br />
        {t("home.before2")}
        <Link to="/organizer/events/new" className={linkClass}>
          {t("home.link2")}
        </Link>
        {t("home.after2")}
      </p>
    </section>
  );
}
