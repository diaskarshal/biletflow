import { useState } from "react";
import { Link } from "react-router-dom";
import type { components } from "../api/schema";
import { EventCard } from "../components/EventCard";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { useOrganizerEvents } from "../hooks/useOrganizerEvents";
import { errorMessage } from "../lib/format";

type Event = components["schemas"]["EventOut"];
const TABS = ["Upcoming", "Active", "Completed", "Cancelled", "Drafts"] as const;
type Tab = (typeof TABS)[number];

function eventPhase(e: Event, now = Date.now()): Tab {
  if (e.status === "cancelled") return "Cancelled";
  if (e.status === "draft") return "Drafts";
  if (e.status === "completed" || Date.parse(e.ends_at) < now) return "Completed";
  if (Date.parse(e.starts_at) <= now) return "Active";
  return "Upcoming";
}

export function Organizer() {
  const events = useOrganizerEvents();
  const [tab, setTab] = useState<Tab>("Upcoming");
  const shown = events.data?.filter((e) => eventPhase(e) === tab) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <h1 className="font-heading text-5xl">My events</h1>
      <Link
        to="/organizer/events/new"
        className="block rounded-2xl bg-brand px-8 py-5 font-heading text-3xl text-on-brand"
      >
        + New event
      </Link>
      <div className="flex gap-6 border-b border-slate-300" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`pb-2 font-heading text-xl ${tab === t ? "border-b-2 border-brand" : ""}`}
            onClick={() => setTab(t)}
          >
            {t} ({events.data?.filter((e) => eventPhase(e) === t).length ?? 0})
          </button>
        ))}
      </div>
      {events.isLoading && <Spinner />}
      {events.isError && <ErrorState message={errorMessage(events.error, "Could not load your events")} />}
      {events.data && shown.length === 0 && <EmptyState title={`No ${tab.toLowerCase()} events`} />}
      <div className="grid grid-cols-3 gap-6">
        {shown.map((e) => (
          <EventCard key={e.id} event={e} status={e.status} to={`/organizer/events/${e.id}`} />
        ))}
      </div>
    </div>
  );
}
