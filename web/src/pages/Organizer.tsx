import { useState } from "react";
import { Link } from "react-router-dom";
import type { components } from "../api/schema";
import { EventCard } from "../components/EventCard";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { useOrganizerEvents } from "../hooks/useOrganizerEvents";
import { errorMessage } from "../lib/format";
import { t } from "../lib/i18n";

type Event = components["schemas"]["EventOut"];
const TABS = ["upcoming", "active", "completed", "cancelled", "drafts"] as const;
type Tab = (typeof TABS)[number];

function eventPhase(e: Event, now = Date.now()): Tab {
  if (e.status === "cancelled") return "cancelled";
  if (e.status === "draft") return "drafts";
  if (e.status === "completed" || Date.parse(e.ends_at) < now) return "completed";
  if (Date.parse(e.starts_at) <= now) return "active";
  return "upcoming";
}

function reviewLabel(e: Event) {
  if (e.status !== "published" || e.review_status === "approved") return e.status;
  return e.review_status === "rejected" ? "rejected" : "in_review";
}

export function Organizer() {
  const events = useOrganizerEvents();
  const [tab, setTab] = useState<Tab>("upcoming");
  const shown = events.data?.filter((e) => eventPhase(e) === tab) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="font-heading text-3xl sm:text-5xl">{t("organizer.title")}</h1>
      <Link
        to="/organizer/events/new"
        className="block rounded-2xl bg-brand px-5 py-4 font-heading text-xl text-on-brand sm:px-8 sm:py-5 sm:text-3xl"
      >
        {t("organizer.new")}
      </Link>
      <div className="-mx-4 flex gap-6 overflow-x-auto border-b border-slate-300 px-4 sm:mx-0 sm:px-0" role="tablist">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            className={`shrink-0 whitespace-nowrap pb-2 font-heading text-lg sm:text-xl ${tab === name ? "border-b-2 border-brand" : ""}`}
            onClick={() => setTab(name)}
          >
            {t(`organizer.tab.${name}`)} ({events.data?.filter((e) => eventPhase(e) === name).length ?? 0})
          </button>
        ))}
      </div>
      {events.isLoading && <Spinner />}
      {events.isError && <ErrorState message={errorMessage(events.error, t("organizer.loadFailed"))} />}
      {events.data && shown.length === 0 && <EmptyState title={t(`organizer.empty.${tab}`)} />}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((e) => (
          <EventCard key={e.id} event={e} status={reviewLabel(e)} to={`/organizer/events/${e.id}`} />
        ))}
      </div>
    </div>
  );
}
