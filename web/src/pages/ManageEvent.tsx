import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { StatusBadge } from "../components/Badge";
import { Button } from "../components/Button";
import { CoverUpload } from "../components/CoverUpload";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Input } from "../components/Input";
import { Spinner } from "../components/Spinner";
import { useOrganizerEvents } from "../hooks/useOrganizerEvents";
import { eventRange, localParts } from "../lib/eventTimes";
import { downloadBlob } from "../lib/download";
import {
  errorMessage,
  formatDate,
  formatDateTime,
  formatKzt,
  formatPrice,
  formatTime,
  REFUND_POLICIES,
  type RefundPolicy,
} from "../lib/format";

type Event = components["schemas"]["EventOut"];

export function ManageEvent() {
  const id = Number(useParams().id);
  const events = useOrganizerEvents();

  if (events.isLoading) return <Spinner />;
  const event = events.data?.find((e) => e.id === id);
  if (!event) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <ErrorState message={errorMessage(events.error, "Event not found")} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-12">
      <div className="space-y-3">
        <Link to="/organizer" className="underline">
          Back to my events
        </Link>
        <h1 className="font-heading text-5xl">{event.title}</h1>
        {event.suspended_at && (
          <p className="border border-red-700 p-3 text-red-700">
            The platform suspended this event. It is hidden and cannot take new orders. Contact platform support for
            details.
          </p>
        )}
        <div className="flex items-center gap-4 text-xl">
          <StatusBadge status={event.status} />
          <span>
            {formatDate(event.starts_at, event.display_timezone)} at {formatTime(event.starts_at, event.display_timezone)}
          </span>
          {event.status === "published" && (
            <Link to={`/events/${event.slug}`} className="underline">
              Open public page
            </Link>
          )}
          <Link to={`/organizer/events/${id}/analytics`} className="underline">
            Analytics
          </Link>
          <EventActions event={event} />
          {(event.status === "published" || event.status === "draft") && <CancelEvent eventId={id} />}
        </div>
      </div>
      {(event.status === "published" || event.status === "draft") && !event.suspended_at && (
        <>
          <EditEvent key={event.id} event={event} />
          <TicketTypes eventId={id} />
        </>
      )}
      <Attendees eventId={id} />
      <DoorStaff eventId={id} />
      <PaidSales eventId={id} />
      <Campaigns eventId={id} />
      <Activity eventId={id} />
    </div>
  );
}

function EventActions({ event }: { event: Event }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["organizer-events"] });
    queryClient.invalidateQueries({ queryKey: ["activity", event.id] });
  };
  const path = { params: { path: { event_id: event.id } } };
  const publish = useMutation({
    mutationFn: async () => {
      const { error } = await api.POST("/api/v1/events/{event_id}/publish", path);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const unpublish = useMutation({
    mutationFn: async () => {
      const { error } = await api.POST("/api/v1/events/{event_id}/unpublish", path);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const duplicate = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/api/v1/events/{event_id}/duplicate", path);
      if (error) throw error;
      return data;
    },
    onSuccess: (copy) => {
      refresh();
      navigate(`/organizer/events/${copy.id}`);
    },
  });
  const failed = publish.error ?? unpublish.error ?? duplicate.error;

  return (
    <>
      {event.status === "draft" && (
        <Button loading={publish.isPending} onClick={() => publish.mutate()}>
          Publish
        </Button>
      )}
      {event.status === "published" && (
        <Button variant="secondary" loading={unpublish.isPending} onClick={() => unpublish.mutate()}>
          Unpublish
        </Button>
      )}
      {!event.suspended_at && (
        <Button variant="secondary" loading={duplicate.isPending} onClick={() => duplicate.mutate()}>
          Duplicate
        </Button>
      )}
      {failed && <ErrorState message={errorMessage(failed)} />}
    </>
  );
}

function EditEvent({ event }: { event: Event }) {
  const queryClient = useQueryClient();
  const start = localParts(event.starts_at);
  const end = localParts(event.ends_at);
  const initial = {
    title: event.title,
    description: event.description ?? "",
    venueName: event.venue_name ?? "",
    address: event.venue_address ?? "",
    image: event.cover_image_url ?? "",
    dateFrom: start.date,
    timeFrom: start.time,
    dateTo: end.date,
    timeTo: end.time,
    refundPolicy: event.refund_policy as RefundPolicy,
  };
  const [form, setForm] = useState(initial);
  const set = (field: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [field]: e.target.value });
  const range = eventRange(form);
  const timesChanged = (["dateFrom", "timeFrom", "dateTo", "timeTo"] as const).some((k) => form[k] !== initial[k]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await api.PATCH("/api/v1/events/{event_id}", {
        params: { path: { event_id: event.id } },
        body: {
          ...(form.title !== initial.title && { title: form.title.trim() }),
          ...(form.description !== initial.description && { description: form.description.trim() }),
          ...(form.venueName !== initial.venueName && { venue_name: form.venueName.trim() }),
          ...(form.address !== initial.address && { venue_address: form.address.trim() }),
          ...(form.image !== initial.image && { cover_image_url: form.image.trim() }),
          ...(timesChanged && { starts_at: range.starts_at, ends_at: range.ends_at }),
          ...(form.refundPolicy !== initial.refundPolicy && { refund_policy: form.refundPolicy }),
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizer-events"] });
      queryClient.invalidateQueries({ queryKey: ["activity", event.id] });
    },
  });

  const field = "border-slate-400!";
  return (
    <Section title="Event details" note="Times are in Almaty time.">
      <form
        className="grid max-w-3xl grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label className="col-span-2 space-y-1">
          <span className="block">Title</span>
          <Input required className={field} value={form.title} onChange={set("title")} />
        </label>
        <label className="col-span-2 space-y-1">
          <span className="block">Description</span>
          <textarea rows={4} className="w-full border border-slate-400 px-3 py-2" value={form.description} onChange={set("description")} />
        </label>
        <label className="space-y-1">
          <span className="block">Venue</span>
          <Input className={field} value={form.venueName} onChange={set("venueName")} />
        </label>
        <label className="space-y-1">
          <span className="block">Address</span>
          <Input className={field} value={form.address} onChange={set("address")} />
        </label>
        <label className="space-y-1">
          <span className="block">Start date</span>
          <Input required type="date" className={field} value={form.dateFrom} onChange={set("dateFrom")} />
        </label>
        <label className="space-y-1">
          <span className="block">Start time</span>
          <Input required type="time" className={field} value={form.timeFrom} onChange={set("timeFrom")} />
        </label>
        <label className="space-y-1">
          <span className="block">End date</span>
          <Input required type="date" className={field} value={form.dateTo} onChange={set("dateTo")} />
        </label>
        <label className="space-y-1">
          <span className="block">End time</span>
          <Input required type="time" className={field} value={form.timeTo} onChange={set("timeTo")} />
        </label>
        <div className="space-y-1">
          <span className="block">Cover image</span>
          <CoverUpload value={form.image} onChange={(image) => setForm({ ...form, image })} />
        </div>
        <label className="space-y-1">
          <span className="block">Refund policy</span>
          <select className="w-full rounded-xl border border-slate-400 bg-white px-3 py-2" value={form.refundPolicy} onChange={set("refundPolicy")}>
            {Object.entries(REFUND_POLICIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-2 flex items-center gap-4">
          <Button type="submit" disabled={!range.valid} loading={save.isPending}>
            Save changes
          </Button>
          {!range.valid && <span className="text-red-700">The event must end after it starts.</span>}
          {save.isSuccess && <span>Saved.</span>}
        </div>
        {save.isError && (
          <div className="col-span-2">
            <ErrorState message={errorMessage(save.error, "Could not save the event")} />
          </div>
        )}
      </form>
    </Section>
  );
}

function TicketTypes({ eventId }: { eventId: number }) {
  const types = useQuery({
    queryKey: ["ticket-types", eventId],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/events/{event_id}/ticket-types", {
        params: { path: { event_id: eventId } },
      });
      if (error) throw error;
      return data;
    },
  });
  return (
    <Section title="Ticket types" note="Capacity cannot go below the tickets already sold.">
      {types.isError && <ErrorState message={errorMessage(types.error)} />}
      <table className="w-full max-w-3xl text-left">
        <thead>
          <tr className="border-b border-brand">
            {["Name", "Sold", "Price (KZT)", "Capacity", "Max per person", ""].map((h) => (
              <th key={h} className="py-2 pr-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {types.data?.map((t) => (
            <TicketTypeRow key={t.id} eventId={eventId} ticketType={t} />
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function TicketTypeRow({ eventId, ticketType }: { eventId: number; ticketType: components["schemas"]["TicketTypeOut"] }) {
  const queryClient = useQueryClient();
  const [price, setPrice] = useState(String(ticketType.price_kzt));
  const [capacity, setCapacity] = useState(String(ticketType.quantity_total));
  const [limit, setLimit] = useState(ticketType.max_per_order ? String(ticketType.max_per_order) : "");
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await api.PATCH("/api/v1/ticket-types/{ticket_type_id}", {
        params: { path: { ticket_type_id: ticketType.id } },
        body: { price_kzt: Number(price), quantity_total: Number(capacity), max_per_order: limit ? Number(limit) : null },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-types", eventId] });
      queryClient.invalidateQueries({ queryKey: ["activity", eventId] });
    },
  });
  const changed =
    price !== String(ticketType.price_kzt) ||
    capacity !== String(ticketType.quantity_total) ||
    limit !== (ticketType.max_per_order ? String(ticketType.max_per_order) : "");
  const filled = price !== "" && capacity !== "" && (limit === "" || Number(limit) >= 1);
  return (
    <tr className="border-b border-slate-200">
      <td className="py-2 pr-3">{ticketType.name}</td>
      <td className="py-2 pr-3">{ticketType.quantity_sold}</td>
      <td className="py-2 pr-3">
        <Input type="number" min={0} aria-label={`${ticketType.name} price`} className="w-32 border-slate-400!" value={price} onChange={(e) => setPrice(e.target.value)} />
      </td>
      <td className="py-2 pr-3">
        <Input type="number" min={1} aria-label={`${ticketType.name} capacity`} className="w-28 border-slate-400!" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
      </td>
      <td className="py-2 pr-3">
        <Input
          type="number"
          min={1}
          placeholder="No limit"
          aria-label={`${ticketType.name} max per person`}
          className="w-28 border-slate-400!"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />
      </td>
      <td className="py-2">
        <Button variant="secondary" disabled={!changed || !filled} loading={save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
        {save.isError && <ErrorState message={errorMessage(save.error)} />}
      </td>
    </tr>
  );
}

const ACTIVITY_TYPES: Record<string, string> = {
  "": "All",
  event: "Event changes",
  ticket_type: "Ticket types",
  order: "Orders and refunds",
  payment: "Payments",
  promo: "Promo codes",
  checkin: "Check-ins",
  support: "Support cases",
};

function Activity({ eventId }: { eventId: number }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [action, setAction] = useState("");
  const activity = useQuery({
    queryKey: ["activity", eventId, from, to, action],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/events/{event_id}/activity", {
        params: {
          path: { event_id: eventId },
          query: { date_from: from || null, date_to: to || null, action: action || null },
        },
      });
      if (error) throw error;
      return data;
    },
  });

  return (
    <Section title="Activity">
      <div className="flex flex-wrap gap-4">
        <label>
          From{" "}
          <input type="date" className="border border-slate-400 px-2 py-1" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To <input type="date" className="border border-slate-400 px-2 py-1" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          Type{" "}
          <select className="border border-slate-400 px-2 py-1" value={action} onChange={(e) => setAction(e.target.value)}>
            {Object.entries(ACTIVITY_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      {activity.isError && <ErrorState message={errorMessage(activity.error)} />}
      {activity.data?.length === 0 && <EmptyState title="No activity for these filters" />}
      {!!activity.data?.length && (
        <div className="max-h-[32rem] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brand">
                {["When", "Who", "Action", "Details"].map((h) => (
                  <th key={h} className="py-2 pr-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activity.data.map((a) => (
                <tr key={a.id} className="border-b border-slate-200 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {formatDateTime(a.created_at)}
                  </td>
                  <td className="py-2 pr-3">{a.actor_name}</td>
                  <td className="py-2 pr-3">{a.action_type}</td>
                  <td className="py-2 pr-3">{a.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function CancelEvent({ eventId }: { eventId: number }) {
  const queryClient = useQueryClient();
  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await api.POST("/api/v1/events/{event_id}/cancel", {
        params: { path: { event_id: eventId } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizer-events"] });
      queryClient.invalidateQueries({ queryKey: ["attendees", eventId] });
    },
  });
  return (
    <Button
      variant="danger"
      loading={cancel.isPending}
      onClick={() => {
        if (window.confirm("Cancel this event? Every ticket stops working and paid orders are refunded.")) cancel.mutate();
      }}
    >
      Cancel event
    </Button>
  );
}

function Attendees({ eventId }: { eventId: number }) {
  const attendees = useQuery({
    queryKey: ["attendees", eventId],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/events/{event_id}/attendees", {
        params: { path: { event_id: eventId } },
      });
      if (error) throw error;
      return data;
    },
  });
  const queryClient = useQueryClient();
  const cancel = useMutation({
    mutationFn: async (orderId: number) => {
      const { error } = await api.POST("/api/v1/orders/{order_id}/cancel", {
        params: { path: { order_id: orderId } },
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendees", eventId] }),
  });
  const rows = attendees.data ?? [];
  const active = rows.filter((a) => a.status === "valid" || a.status === "checked_in");
  const checkedIn = active.filter((a) => a.status === "checked_in").length;

  function cancelOrder(a: (typeof rows)[number]) {
    const action = a.order_total_kzt > 0 ? `Refund ${formatPrice(a.order_total_kzt)} KZT for` : "Cancel";
    if (window.confirm(`${action} order #${a.order_id}? Its tickets stop working.`)) cancel.mutate(a.order_id);
  }

  return (
    <Section title="Attendees" note={attendees.data && `${checkedIn} of ${active.length} checked in`}>
      {cancel.isError && <ErrorState message={errorMessage(cancel.error, "Could not cancel the order")} />}
      {attendees.isLoading && <Spinner />}
      {attendees.isError && <ErrorState message={errorMessage(attendees.error, "Could not load attendees")} />}
      {attendees.isSuccess && rows.length === 0 && <EmptyState title="No registrations yet" />}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-brand font-heading">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Ticket</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.ticket_id} className="border-b border-slate-200">
                  <td className="py-2 pr-4">{a.attendee_name}</td>
                  <td className="py-2 pr-4">{a.attendee_email}</td>
                  <td className="py-2 pr-4">{a.ticket_type_name}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="py-2 text-right">
                    {a.status === "valid" && (
                      <Button variant="secondary" disabled={cancel.isPending} onClick={() => cancelOrder(a)}>
                        {a.order_total_kzt > 0 ? "Refund" : "Cancel"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function DoorStaff({ eventId }: { eventId: number }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");

  const staff = useQuery({
    queryKey: ["staff", eventId],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/events/{event_id}/staff", {
        params: { path: { event_id: eventId } },
      });
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await api.POST("/api/v1/events/{event_id}/staff", {
        params: { path: { event_id: eventId } },
        body: { email: email.trim(), role: "event_admin" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["staff", eventId] });
    },
  });

  return (
    <Section
      title="Door staff"
      note="They can scan tickets for this event in the BiletFlow Check-in app. They need a BiletFlow account first."
    >
      {staff.isError && <ErrorState message={errorMessage(staff.error, "Could not load door staff")} />}
      {staff.data && staff.data.length > 0 && (
        <ul className="space-y-1">
          {staff.data.map((s) => (
            <li key={s.id}>
              {s.full_name} ({s.email})
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex max-w-xl gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <label htmlFor="staff-email" className="sr-only">
          Staff email
        </label>
        <Input
          id="staff-email"
          required
          type="email"
          placeholder="scanner@example.com"
          className="border-brand!"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" loading={add.isPending} className="shrink-0">
          Add
        </Button>
      </form>
      {add.isError && <ErrorState message={errorMessage(add.error, "Could not add this person")} />}
    </Section>
  );
}

function PaidSales({ eventId }: { eventId: number }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const activation = useQuery({
    queryKey: ["activation", eventId],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/events/{event_id}/activation", {
        params: { path: { event_id: eventId } },
      });
      if (error) throw error;
      return data;
    },
  });

  const terms = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/api/v1/events/{event_id}/activation/terms", {
        params: { path: { event_id: eventId } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => queryClient.setQueryData(["activation", eventId], data),
  });

  const pay = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/api/v1/events/{event_id}/activation/payment", {
        params: { path: { event_id: eventId } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => navigate(`/pay/${data.payment_id}`),
  });

  const a = activation.data;
  if (!a) return null;

  if (a.paid_sales_enabled || a.suspended) {
    return (
      <Section title="Paid sales">
        <p>{a.suspended ? "Paid sales were suspended by a platform admin." : "Paid sales are active for this event."}</p>
      </Section>
    );
  }

  const ready = a.has_paid_ticket_type && a.organizer_verified && a.payout_account_set && a.terms_accepted;
  const profileLink = (
    <Link to="/profile" className="underline">
      Profile
    </Link>
  );

  return (
    <Section title="Paid sales" note="Free tickets need nothing. To sell paid tickets, complete every step below.">
      <table className="w-full text-left">
        <tbody>
          <Step done={a.has_paid_ticket_type} label="The event has a paid ticket type" />
          <Step done={a.organizer_verified} label="Identity verification approved" action={profileLink} />
          <Step done={a.payout_account_set} label="Payout account added" action={profileLink} />
          <Step
            done={a.terms_accepted}
            label="Paid-event terms accepted: BiletFlow keeps payment processing charges, refunds follow your refund policy."
            action={
              <Button variant="secondary" loading={terms.isPending} onClick={() => terms.mutate()}>
                Accept terms
              </Button>
            }
          />
          <Step
            done={a.fee_paid}
            label={`Activation fee paid (${formatPrice(a.fee_kzt)} KZT, once per event)`}
            action={
              <Button disabled={!ready} loading={pay.isPending} onClick={() => pay.mutate()}>
                {a.pending_payment_id ? "Continue payment" : "Pay activation fee"}
              </Button>
            }
          />
        </tbody>
      </table>
      {pay.isError && <ErrorState message={errorMessage(pay.error, "Could not start the payment")} />}
      <p>
        <Link className="underline" to={`/support/new?kind=organizer&event_id=${eventId}`}>
          Problem with activation? Contact platform support
        </Link>
      </p>
    </Section>
  );
}

function Campaigns({ eventId }: { eventId: number }) {
  const queryClient = useQueryClient();
  const campaigns = useQuery({
    queryKey: ["campaigns", eventId],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/events/{event_id}/campaigns", {
        params: { path: { event_id: eventId } },
      });
      if (error) throw error;
      return data;
    },
  });
  const types = useQuery({
    queryKey: ["ticket-types", eventId],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/events/{event_id}/ticket-types", {
        params: { path: { event_id: eventId } },
      });
      if (error) throw error;
      return data;
    },
  });
  const empty = { name: "", code: "", type: "percent" as "percent" | "fixed", value: "", max: "", until: "", typeIds: [] as number[] };
  const [form, setForm] = useState(empty);

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await api.POST("/api/v1/events/{event_id}/campaigns", {
        params: { path: { event_id: eventId } },
        body: {
          name: form.name,
          code: form.code || null,
          discount_type: form.type,
          discount_value: Number(form.value),
          max_redemptions: form.max ? Number(form.max) : null,
          valid_until: form.until ? new Date(`${form.until}T23:59:59+05:00`).toISOString() : null,
          ticket_type_ids: form.typeIds.length ? form.typeIds : null,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm(empty);
      queryClient.invalidateQueries({ queryKey: ["campaigns", eventId] });
    },
  });

  const disable = useMutation({
    mutationFn: async (campaignId: number) => {
      const { error } = await api.POST("/api/v1/campaigns/{campaign_id}/disable", {
        params: { path: { campaign_id: campaignId } },
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaigns", eventId] }),
  });

  async function downloadQr(campaignId: number, code: string) {
    const { data } = await api.GET("/api/v1/campaigns/{campaign_id}/qr", {
      params: { path: { campaign_id: campaignId } },
      parseAs: "blob",
    });
    if (data) downloadBlob(data as Blob, `promo-${code}.png`);
  }

  const rows = campaigns.data ?? [];

  return (
    <Section title="Promo codes" note="Each code also gets a Campaign QR that opens this event with the code applied. It is not an entry ticket.">
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brand">
                {["Code", "Discount", "Used", "Orders", "Tickets", "Gross", "Discounts", "Net", "Status", ""].map((h) => (
                  <th key={h} className="py-2 pr-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-slate-200">
                  <td className="py-2 pr-3 font-semibold">{c.code}</td>
                  <td className="py-2 pr-3">{c.discount_type === "percent" ? `${c.discount_value}%` : formatKzt(c.discount_value)}</td>
                  <td className="py-2 pr-3">
                    {c.redemptions}
                    {c.max_redemptions ? ` / ${c.max_redemptions}` : ""}
                  </td>
                  <td className="py-2 pr-3">{c.orders}</td>
                  <td className="py-2 pr-3">{c.tickets_sold}</td>
                  <td className="py-2 pr-3">{formatKzt(c.gross_kzt)}</td>
                  <td className="py-2 pr-3">{formatKzt(c.discount_kzt)}</td>
                  <td className="py-2 pr-3">{formatKzt(c.net_kzt)}</td>
                  <td className="py-2 pr-3">{c.disabled ? "Disabled" : "Active"}</td>
                  <td className="space-x-2 py-2 whitespace-nowrap">
                    <button type="button" className="underline" onClick={() => downloadQr(c.id, c.code)}>
                      QR image
                    </button>
                    <button type="button" className="underline" onClick={() => navigator.clipboard.writeText(c.link)}>
                      Copy link
                    </button>
                    {!c.disabled && (
                      <button type="button" className="underline" onClick={() => disable.mutate(c.id)}>
                        Disable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form
        className="grid max-w-3xl grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <h3 className="col-span-2 font-heading text-xl">New promo code</h3>
        <label className="space-y-1">
          <span className="block">Campaign name</span>
          <Input required className="border-slate-400!" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="block">Code (leave empty to generate)</span>
          <Input className="border-slate-400!" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="block">Discount type</span>
          <select
            className="w-full rounded-xl border border-slate-400 bg-white px-3 py-2"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as "percent" | "fixed" })}
          >
            <option value="percent">Percent</option>
            <option value="fixed">Fixed amount (KZT)</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="block">{form.type === "percent" ? "Percent off" : "KZT off"}</span>
          <Input required type="number" min={1} max={form.type === "percent" ? 100 : undefined} className="border-slate-400!" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="block">Maximum uses (optional)</span>
          <Input type="number" min={1} className="border-slate-400!" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="block">Valid until (optional)</span>
          <Input type="date" className="border-slate-400!" value={form.until} onChange={(e) => setForm({ ...form, until: e.target.value })} />
        </label>
        {!!types.data?.length && (
          <fieldset className="col-span-2">
            <legend>Applies to (none ticked means all ticket types)</legend>
            {types.data.map((t) => (
              <label key={t.id} className="mr-4 inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={form.typeIds.includes(t.id)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      typeIds: e.target.checked ? [...form.typeIds, t.id] : form.typeIds.filter((x) => x !== t.id),
                    })
                  }
                />
                {t.name}
              </label>
            ))}
          </fieldset>
        )}
        <div className="col-span-2">
          <Button type="submit" loading={create.isPending}>
            Create promo code
          </Button>
        </div>
        {create.isError && (
          <div className="col-span-2">
            <ErrorState message={errorMessage(create.error, "Could not create the promo code")} />
          </div>
        )}
      </form>
    </Section>
  );
}

function Step({ done, label, action }: { done: boolean; label: string; action?: ReactNode }) {
  return (
    <tr className="border-b border-slate-200">
      <td className="w-24 py-2 pr-4 font-semibold">{done ? "Done" : "Missing"}</td>
      <td className="py-2 pr-4">{label}</td>
      <td className="py-2 text-right">{!done && action}</td>
    </tr>
  );
}

function Section({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4 border border-slate-300 p-6">
      <div>
        <h2 className="font-heading text-3xl">{title}</h2>
        {note && <p className="mt-1">{note}</p>}
      </div>
      {children}
    </section>
  );
}
