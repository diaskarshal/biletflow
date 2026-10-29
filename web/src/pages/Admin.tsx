import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { Block, Table } from "../components/Block";
import { Button } from "../components/Button";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Input } from "../components/Input";
import { useAuth } from "../context/AuthContext";
import { downloadBlob } from "../lib/download";
import { errorMessage, formatDateTime, formatKzt } from "../lib/format";

export function Admin() {
  const { user } = useAuth();
  if (!user?.is_admin) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <ErrorState message="This page is for platform admins." />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-6 py-12">
      <h1 className="text-3xl font-bold">Platform admin</h1>
      <PendingEvents />
      <Search />
      <Reports />
      <Verifications />
      <ActivationFee />
      <Activations />
      <Payments />
      <Promos />
      <Exports />
    </div>
  );
}

function Verifications() {
  const queryClient = useQueryClient();
  const pending = useQuery({
    queryKey: ["admin-organizers"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/admin/organizers", { params: { query: { status: "pending" } } });
      if (error) throw error;
      return data;
    },
  });
  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" }) => {
      const { error } = await api.POST("/api/v1/admin/organizers/{organizer_id}/verification", {
        params: { path: { organizer_id: id } },
        body: { status },
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-organizers"] }),
  });

  return (
    <Block title="Organizer verification requests">
      {pending.isError && <ErrorState message={errorMessage(pending.error)} />}
      {pending.data?.length === 0 && <EmptyState title="No requests waiting" />}
      {!!pending.data?.length && (
        <Table head={["Organizer", "Email", "Document", "Payout account", ""]}>
          {pending.data.map((o) => (
            <tr key={o.id} className="border-b border-slate-200">
              <td className="py-2 pr-4">{o.display_name}</td>
              <td className="py-2 pr-4">{o.email}</td>
              <td className="py-2 pr-4">{o.verification_document}</td>
              <td className="py-2 pr-4">{o.payout_account ?? "Not set"}</td>
              <td className="space-x-2 py-2 text-right whitespace-nowrap">
                <Button onClick={() => decide.mutate({ id: o.id, status: "approved" })} disabled={decide.isPending}>
                  Approve
                </Button>
                <Button variant="danger" onClick={() => decide.mutate({ id: o.id, status: "rejected" })} disabled={decide.isPending}>
                  Reject
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
      {decide.isError && <ErrorState message={errorMessage(decide.error)} />}
    </Block>
  );
}

function ActivationFee() {
  const fee = useQuery({
    queryKey: ["admin-fee"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/admin/settings/activation-fee");
      if (error) throw error;
      return data;
    },
  });
  return (
    <Block title="Paid sales activation fee">
      {fee.data && <FeeForm initial={fee.data.amount_kzt} />}
    </Block>
  );
}

function FeeForm({ initial }: { initial: number }) {
  const [value, setValue] = useState(String(initial));
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await api.PUT("/api/v1/admin/settings/activation-fee", { body: { amount_kzt: Number(value) } });
      if (error) throw error;
    },
  });

  return (
    <>
      <form
        className="flex items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label htmlFor="fee">KZT per event</label>
        <Input id="fee" type="number" min={0} required className="max-w-40 border-slate-400!" value={value} onChange={(e) => setValue(e.target.value)} />
        <Button type="submit" loading={save.isPending}>
          Save
        </Button>
        {save.isSuccess && <span>Saved.</span>}
      </form>
      {save.isError && <ErrorState message={errorMessage(save.error)} />}
    </>
  );
}

function Activations() {
  const queryClient = useQueryClient();
  const events = useQuery({
    queryKey: ["admin-activations"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/admin/activations");
      if (error) throw error;
      return data;
    },
  });
  const toggle = useMutation({
    mutationFn: async ({ id, suspended }: { id: number; suspended: boolean }) => {
      const { error } = await api.POST("/api/v1/admin/events/{event_id}/paid-sales", {
        params: { path: { event_id: id } },
        body: { suspended },
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-activations"] }),
  });

  return (
    <Block title="Events with paid sales">
      {events.data?.length === 0 && <EmptyState title="No event has activated paid sales yet" />}
      {!!events.data?.length && (
        <Table head={["Event", "Activated", "Status", ""]}>
          {events.data.map((e) => (
            <tr key={e.event_id} className="border-b border-slate-200">
              <td className="py-2 pr-4">{e.title}</td>
              <td className="py-2 pr-4">{e.activation_paid_at && new Date(e.activation_paid_at).toLocaleString("en-GB")}</td>
              <td className="py-2 pr-4">{e.suspended ? "Suspended" : "Selling"}</td>
              <td className="py-2 text-right">
                <Button
                  variant={e.suspended ? "secondary" : "danger"}
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: e.event_id, suspended: !e.suspended })}
                >
                  {e.suspended ? "Resume" : "Suspend"}
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Block>
  );
}


function useSuspend(kind: "users" | "events") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, suspended }: { id: number; suspended: boolean }) => {
      const { error } =
        kind === "users"
          ? await api.POST("/api/v1/admin/users/{user_id}/suspension", { params: { path: { user_id: id } }, body: { suspended } })
          : await api.POST("/api/v1/admin/events/{event_id}/suspension", { params: { path: { event_id: id } }, body: { suspended } });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-search"] });
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
  });
}

function Search() {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const result = useQuery({
    queryKey: ["admin-search", q],
    enabled: q !== "",
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/admin/search", { params: { query: { q } } });
      if (error) throw error;
      return data;
    },
  });
  const suspendUser = useSuspend("users");
  const suspendEvent = useSuspend("events");
  const r = result.data;
  const failed = suspendUser.error ?? suspendEvent.error;

  return (
    <Block title="Search">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(input.trim());
        }}
      >
        <Input aria-label="Search" placeholder="Email, name, event title, order or payment number" value={input} onChange={(e) => setInput(e.target.value)} />
        <Button type="submit">Search</Button>
      </form>
      {result.isError && <ErrorState message={errorMessage(result.error)} />}
      {failed && <ErrorState message={errorMessage(failed)} />}
      {r && r.users.length + r.events.length + r.orders.length + r.payments.length === 0 && <EmptyState title="Nothing found" />}
      {!!r?.users.length && (
        <Table head={["User", "Email", "Status", ""]}>
          {r.users.map((u) => (
            <tr key={u.id} className="border-b border-slate-200">
              <td className="py-2 pr-4">
                {u.full_name}
                {u.is_admin ? " (admin)" : ""}
              </td>
              <td className="py-2 pr-4">{u.email}</td>
              <td className="py-2 pr-4">{u.suspended ? "Suspended" : "Active"}</td>
              <td className="py-2 text-right">
                <Button variant={u.suspended ? "secondary" : "danger"} onClick={() => suspendUser.mutate({ id: u.id, suspended: !u.suspended })}>
                  {u.suspended ? "Restore" : "Suspend"}
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
      {!!r?.events.length && (
        <Table head={["Event", "Status", ""]}>
          {r.events.map((e) => (
            <tr key={e.id} className="border-b border-slate-200">
              <td className="py-2 pr-4">
                <Link className="underline" to={`/events/${e.slug}`}>
                  {e.title}
                </Link>
              </td>
              <td className="py-2 pr-4">{e.suspended ? "Suspended" : e.status}</td>
              <td className="py-2 text-right">
                <Button variant={e.suspended ? "secondary" : "danger"} onClick={() => suspendEvent.mutate({ id: e.id, suspended: !e.suspended })}>
                  {e.suspended ? "Restore" : "Suspend"}
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
      {!!r?.orders.length && (
        <Table head={["Order", "Event", "Buyer", "Status", "Total", "Created"]}>
          {r.orders.map((o) => (
            <tr key={o.id} className="border-b border-slate-200">
              <td className="py-2 pr-4">#{o.id}</td>
              <td className="py-2 pr-4">{o.event_title}</td>
              <td className="py-2 pr-4">{o.buyer_email}</td>
              <td className="py-2 pr-4">{o.status}</td>
              <td className="py-2 pr-4">{formatKzt(o.total_kzt)}</td>
              <td className="py-2 pr-4">{formatDateTime(o.created_at)}</td>
            </tr>
          ))}
        </Table>
      )}
      {!!r?.payments.length && <PaymentTable rows={r.payments} />}
    </Block>
  );
}

function PaymentTable({ rows }: { rows: components["schemas"]["PaymentRow"][] }) {
  return (
    <Table head={["Payment", "For", "Event", "Payer", "Amount", "Status", "Created"]}>
      {rows.map((p) => (
        <tr key={p.id} className="border-b border-slate-200">
          <td className="py-2 pr-4">#{p.id}</td>
          <td className="py-2 pr-4">{p.purpose}</td>
          <td className="py-2 pr-4">{p.event_title}</td>
          <td className="py-2 pr-4">{p.user_email}</td>
          <td className="py-2 pr-4">{formatKzt(p.amount_kzt)}</td>
          <td className="py-2 pr-4">{p.status}</td>
          <td className="py-2 pr-4">{formatDateTime(p.created_at)}</td>
        </tr>
      ))}
    </Table>
  );
}

function Reports() {
  const queryClient = useQueryClient();
  const reports = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/admin/reports");
      if (error) throw error;
      return data;
    },
  });
  const suspend = useSuspend("events");
  const dismiss = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await api.POST("/api/v1/admin/reports/{report_id}/dismiss", { params: { path: { report_id: id } } });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reports"] }),
  });

  return (
    <Block title="Reported events">
      {reports.data?.length === 0 && <EmptyState title="No open reports" />}
      {!!reports.data?.length && (
        <Table head={["Event", "Reported by", "Reason", "When", ""]}>
          {reports.data.map((r) => (
            <tr key={r.id} className="border-b border-slate-200 align-top">
              <td className="py-2 pr-4">{r.event_title}</td>
              <td className="py-2 pr-4">{r.reporter_email}</td>
              <td className="py-2 pr-4 whitespace-pre-wrap">{r.reason}</td>
              <td className="py-2 pr-4">{formatDateTime(r.created_at)}</td>
              <td className="space-x-2 py-2 text-right whitespace-nowrap">
                {!r.event_suspended && (
                  <Button variant="danger" onClick={() => suspend.mutate({ id: r.event_id, suspended: true })}>
                    Suspend event
                  </Button>
                )}
                <Button variant="secondary" onClick={() => dismiss.mutate(r.id)}>
                  Dismiss
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Block>
  );
}

const PAYMENT_STATUSES = ["failed", "refunded", "expired", "succeeded", "pending"] as const;

function Payments() {
  const [status, setStatus] = useState<(typeof PAYMENT_STATUSES)[number]>("failed");
  const payments = useQuery({
    queryKey: ["admin-payments", status],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/admin/payments", { params: { query: { status } } });
      if (error) throw error;
      return data;
    },
  });
  return (
    <Block title="Payments">
      <label className="block">
        Status{" "}
        <select className="border border-slate-400 px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      {payments.data?.length === 0 && <EmptyState title={`No ${status} payments`} />}
      {!!payments.data?.length && <PaymentTable rows={payments.data} />}
    </Block>
  );
}

function Promos() {
  const promos = useQuery({
    queryKey: ["admin-promos"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/admin/promos");
      if (error) throw error;
      return data;
    },
  });
  return (
    <Block title="Promo code activity">
      {promos.data?.length === 0 && <EmptyState title="No promo codes yet" />}
      {!!promos.data?.length && (
        <Table head={["Code", "Event", "Discount", "Used", "Status", "Created"]}>
          {promos.data.map((c) => (
            <tr key={c.id} className="border-b border-slate-200">
              <td className="py-2 pr-4 font-semibold">{c.code}</td>
              <td className="py-2 pr-4">{c.event_title}</td>
              <td className="py-2 pr-4">{c.discount_type === "percent" ? `${c.discount_value}%` : formatKzt(c.discount_value)}</td>
              <td className="py-2 pr-4">
                {c.redemptions}
                {c.max_redemptions ? ` / ${c.max_redemptions}` : ""}
              </td>
              <td className="py-2 pr-4">{c.disabled ? "Disabled" : "Active"}</td>
              <td className="py-2 pr-4">{formatDateTime(c.created_at)}</td>
            </tr>
          ))}
        </Table>
      )}
    </Block>
  );
}

function Exports() {
  async function download(kind: "orders" | "payments") {
    const { data } = await api.GET("/api/v1/admin/export/{kind}.csv", {
      params: { path: { kind } },
      parseAs: "blob",
    });
    if (data) downloadBlob(data as Blob, `${kind}.csv`);
  }
  return (
    <Block title="Reports">
      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => download("orders")}>
          Download orders CSV
        </Button>
        <Button variant="secondary" onClick={() => download("payments")}>
          Download payments CSV
        </Button>
      </div>
    </Block>
  );
}

function PendingEvents() {
  const queryClient = useQueryClient();
  const pending = useQuery({
    queryKey: ["admin-pending-events"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/admin/events/pending");
      if (error) throw error;
      return data;
    },
  });
  const review = useMutation({
    mutationFn: async ({ id, status, note }: { id: number; status: "approved" | "rejected"; note?: string }) => {
      const { error } = await api.POST("/api/v1/admin/events/{event_id}/review", {
        params: { path: { event_id: id } },
        body: { status, note: note ?? null },
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-pending-events"] }),
  });

  return (
    <Block title="Events waiting for approval">
      {pending.isError && <ErrorState message={errorMessage(pending.error)} />}
      {review.isError && <ErrorState message={errorMessage(review.error)} />}
      {pending.data?.length === 0 && <EmptyState title="No events waiting" />}
      {!!pending.data?.length && (
        <Table head={["Event", "Organizer", "Starts", "Venue", ""]}>
          {pending.data.map((e) => (
            <tr key={e.id} className="border-b border-slate-200 align-top">
              <td className="py-2 pr-4">
                <Link className="underline" to={`/events/${e.slug}`}>
                  {e.title}
                </Link>
                {e.description && <p className="line-clamp-2 text-sm">{e.description}</p>}
              </td>
              <td className="py-2 pr-4">
                {e.organizer}
                <br />
                <span className="text-sm">{e.organizer_email}</span>
              </td>
              <td className="py-2 pr-4">{formatDateTime(e.starts_at)}</td>
              <td className="py-2 pr-4">{e.venue_name}</td>
              <td className="space-x-2 py-2 text-right whitespace-nowrap">
                <Button disabled={review.isPending} onClick={() => review.mutate({ id: e.id, status: "approved" })}>
                  Approve
                </Button>
                <Button
                  variant="danger"
                  disabled={review.isPending}
                  onClick={() => {
                    const note = window.prompt("Why is this event rejected? The organizer will see this.");
                    if (note !== null) review.mutate({ id: e.id, status: "rejected", note });
                  }}
                >
                  Reject
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Block>
  );
}
