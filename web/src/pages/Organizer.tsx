import { Link } from "react-router-dom";
import { EventCard } from "../components/EventCard";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { useOrganizerEvents } from "../hooks/useOrganizerEvents";
import { errorMessage } from "../lib/format";

export function Organizer() {
  const events = useOrganizerEvents();

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <h1 className="font-heading text-5xl">My events</h1>
      <Link
        to="/organizer/events/new"
        className="block rounded-2xl bg-brand px-8 py-5 font-heading text-3xl text-on-brand"
      >
        + New event
      </Link>
      {events.isLoading && <Spinner />}
      {events.isError && <ErrorState message={errorMessage(events.error, "Could not load your events")} />}
      {events.data?.length === 0 && <EmptyState title="You have no events yet" />}
      <div className="grid grid-cols-3 gap-6">
        {events.data?.map((e) => (
          <EventCard key={e.id} event={e} status={e.status} to={`/organizer/events/${e.id}`} />
        ))}
      </div>
    </div>
  );
}
