import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { StatusBadge } from "../components/Badge";
import { Button } from "../components/Button";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Input } from "../components/Input";
import { Spinner } from "../components/Spinner";
import { useOrganizerEvents } from "../hooks/useOrganizerEvents";
import { errorMessage, formatDate, formatPrice, formatTime } from "../lib/format";

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
          {(event.status === "published" || event.status === "draft") && <CancelEvent eventId={id} />}
        </div>
      </div>
      <Attendees eventId={id} />
      <DoorStaff eventId={id} />
      <PaidSales eventId={id} />
      <Campaigns eventId={id} />
    </div>
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
    if (!data) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(data as Blob);
    link.download = `promo-${code}.png`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const rows = campaigns.data ?? [];
  const kzt = (n: number) => `${formatPrice(n)} KZT`;

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
                  <td className="py-2 pr-3">{c.discount_type === "percent" ? `${c.discount_value}%` : kzt(c.discount_value)}</td>
                  <td className="py-2 pr-3">
                    {c.redemptions}
                    {c.max_redemptions ? ` / ${c.max_redemptions}` : ""}
                  </td>
                  <td className="py-2 pr-3">{c.orders}</td>
                  <td className="py-2 pr-3">{c.tickets_sold}</td>
                  <td className="py-2 pr-3">{kzt(c.gross_kzt)}</td>
                  <td className="py-2 pr-3">{kzt(c.discount_kzt)}</td>
                  <td className="py-2 pr-3">{kzt(c.net_kzt)}</td>
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
