import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Block, Table } from "../components/Block";
import { ErrorState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { useOrganizerEvents } from "../hooks/useOrganizerEvents";
import { errorMessage, formatKzt } from "../lib/format";


function Bar({ label, value, max, text }: { label: string; value: number; max: number; text: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr_12rem] items-center gap-3">
      <span>{label}</span>
      <div className="h-5 bg-slate-200">
        <div className="h-5 bg-brand" style={{ width: `${max ? (100 * value) / max : 0}%` }} />
      </div>
      <span className="text-sm">{text}</span>
    </div>
  );
}

export function Analytics() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const events = useOrganizerEvents();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [typeId, setTypeId] = useState("");

  const stats = useQuery({
    queryKey: ["analytics", id, from, to, typeId],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/events/{event_id}/analytics", {
        params: {
          path: { event_id: id },
          query: { date_from: from || null, date_to: to || null, ticket_type_id: typeId ? Number(typeId) : null },
        },
      });
      if (error) throw error;
      return data;
    },
  });
  const types = useQuery({
    queryKey: ["ticket-types", id],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/events/{event_id}/ticket-types", {
        params: { path: { event_id: id } },
      });
      if (error) throw error;
      return data;
    },
  });

  const a = stats.data;
  const maxDay = Math.max(0, ...(a?.sales_by_day.map((d) => d.tickets) ?? []));
  const maxType = Math.max(0, ...(a?.by_ticket_type.map((t) => t.capacity) ?? []));

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-6 py-12">
      <p>
        <Link to={`/organizer/events/${id}`} className="underline">
          Back to event
        </Link>
      </p>
      <h1 className="text-3xl font-bold">Analytics</h1>
      <div className="flex flex-wrap items-end gap-4 border border-slate-300 p-4">
        <label className="space-y-1">
          <span className="block">Event</span>
          <select
            className="border border-slate-400 px-2 py-1"
            value={id}
            onChange={(e) => {
              setTypeId("");
              navigate(`/organizer/events/${e.target.value}/analytics`);
            }}
          >
            {events.data?.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block">From</span>
          <input type="date" className="border border-slate-400 px-2 py-1" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="block">To</span>
          <input type="date" className="border border-slate-400 px-2 py-1" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="block">Ticket type</span>
          <select className="border border-slate-400 px-2 py-1" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">All</option>
            {types.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {stats.isLoading && <Spinner />}
      {stats.isError && <ErrorState message={errorMessage(stats.error)} />}
      {a && (
        <>
          <p className="text-sm">Capacity, remaining and check-in are current totals. Sales and money follow the date range.</p>
          <Block title="Tickets">
            <Table head={["Capacity", "Sold", "Remaining", "Sold %"]}>
              <tr>
                <td className="py-2 pr-4">{a.capacity}</td>
                <td className="py-2 pr-4">{a.sold}</td>
                <td className="py-2 pr-4">{a.remaining}</td>
                <td className="py-2 pr-4">{a.percent_sold}%</td>
              </tr>
            </Table>
          </Block>
          <Block title="Revenue (demonstration)">
            <Table head={["Gross", "Discounts", "Refunds", "Net"]}>
              <tr>
                <td className="py-2 pr-4">{formatKzt(a.gross_kzt)}</td>
                <td className="py-2 pr-4">{formatKzt(a.discount_kzt)}</td>
                <td className="py-2 pr-4">{formatKzt(a.refunds_kzt)}</td>
                <td className="py-2 pr-4 font-bold">{formatKzt(a.net_kzt)}</td>
              </tr>
            </Table>
          </Block>
          <Block title="Sales over time">
            {a.sales_by_day.length === 0 && <p>No sales in this period.</p>}
            {a.sales_by_day.map((d) => (
              <Bar
                key={d.day}
                label={new Date(`${d.day}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                value={d.tickets}
                max={maxDay}
                text={`${d.tickets} tickets, ${formatKzt(d.revenue_kzt)}`}
              />
            ))}
          </Block>
          <Block title="Sales by ticket type">
            {a.by_ticket_type.map((t) => (
              <Bar
                key={t.ticket_type_id}
                label={t.name}
                value={t.sold}
                max={maxType}
                text={`${t.sold} of ${t.capacity}, ${formatKzt(t.revenue_kzt)}`}
              />
            ))}
          </Block>
          <Block title="Check-in">
            <Bar label="Checked in" value={a.checkin_percent} max={100} text={`${a.checkin_percent}% (${a.checked_in} in, ${a.absent} absent)`} />
          </Block>
          <Block title="Campaigns">
            {a.campaigns.length === 0 && <p>No promo codes for this event.</p>}
            {a.campaigns.length > 0 && (
              <Table head={["Code", "Name", "Redemptions", "Tickets", "Discounts", "Net revenue"]}>
                {a.campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-slate-200">
                    <td className="py-2 pr-4 font-semibold">{c.code}</td>
                    <td className="py-2 pr-4">{c.name}</td>
                    <td className="py-2 pr-4">{c.redemptions}</td>
                    <td className="py-2 pr-4">{c.tickets_sold}</td>
                    <td className="py-2 pr-4">{formatKzt(c.discount_kzt)}</td>
                    <td className="py-2 pr-4">{formatKzt(c.net_kzt)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Block>
        </>
      )}
    </div>
  );
}
