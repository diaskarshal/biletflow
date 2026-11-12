import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Block, Table } from "../components/Block";
import { ErrorState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { useOrganizerEvents } from "../hooks/useOrganizerEvents";
import { errorMessage, formatKzt } from "../lib/format";
import { locale, t } from "../lib/i18n";

function Bar({ label, value, max, text }: { label: string; value: number; max: number; text: string }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] items-center gap-x-3 gap-y-1 sm:grid-cols-[8rem_1fr_12rem]">
      <span>{label}</span>
      <div className="h-5 bg-slate-200">
        <div className="h-5 bg-brand" style={{ width: `${max ? (100 * value) / max : 0}%` }} />
      </div>
      <span className="col-span-2 text-sm sm:col-span-1">{text}</span>
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
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6 sm:py-12">
      <p>
        <Link to={`/organizer/events/${id}`} className="underline">
          {t("analytics.back")}
        </Link>
      </p>
      <h1 className="text-2xl font-bold sm:text-3xl">{t("manage.analytics")}</h1>
      <div className="flex flex-wrap items-end gap-4 border border-slate-300 p-4">
        <label className="space-y-1">
          <span className="block">{t("analytics.event")}</span>
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
          <span className="block">{t("manage.from")}</span>
          <input type="date" className="border border-slate-400 px-2 py-1" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="block">{t("manage.to")}</span>
          <input type="date" className="border border-slate-400 px-2 py-1" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="block">{t("checkout.ticketType")}</span>
          <select className="border border-slate-400 px-2 py-1" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">{t("common.all")}</option>
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
          <p className="text-sm">{t("analytics.note")}</p>
          <Block title={t("common.tickets")}>
            <Table head={[t("manage.col.capacity"), t("manage.col.sold"), t("analytics.remaining"), t("analytics.soldPercent")]}>
              <tr>
                <td className="py-2 pr-4">{a.capacity}</td>
                <td className="py-2 pr-4">{a.sold}</td>
                <td className="py-2 pr-4">{a.remaining}</td>
                <td className="py-2 pr-4">{a.percent_sold}%</td>
              </tr>
            </Table>
          </Block>
          <Block title={t("analytics.revenue")}>
            <Table head={[t("manage.col.gross"), t("manage.col.discounts"), t("analytics.refunds"), t("manage.col.net")]}>
              <tr>
                <td className="py-2 pr-4">{formatKzt(a.gross_kzt)}</td>
                <td className="py-2 pr-4">{formatKzt(a.discount_kzt)}</td>
                <td className="py-2 pr-4">{formatKzt(a.refunds_kzt)}</td>
                <td className="py-2 pr-4 font-bold">{formatKzt(a.net_kzt)}</td>
              </tr>
            </Table>
          </Block>
          <Block title={t("analytics.overTime")}>
            {a.sales_by_day.length === 0 && <p>{t("analytics.noSales")}</p>}
            {a.sales_by_day.map((d) => (
              <Bar
                key={d.day}
                label={new Date(`${d.day}T00:00:00`).toLocaleDateString(locale(), { day: "2-digit", month: "short" })}
                value={d.tickets}
                max={maxDay}
                text={t("analytics.dayText", { n: d.tickets, amount: formatKzt(d.revenue_kzt) })}
              />
            ))}
          </Block>
          <Block title={t("analytics.byType")}>
            {a.by_ticket_type.map((tt) => (
              <Bar
                key={tt.ticket_type_id}
                label={tt.name}
                value={tt.sold}
                max={maxType}
                text={t("analytics.typeText", { sold: tt.sold, capacity: tt.capacity, amount: formatKzt(tt.revenue_kzt) })}
              />
            ))}
          </Block>
          <Block title={t("analytics.checkin")}>
            <Bar
              label={t("analytics.checkedIn")}
              value={a.checkin_percent}
              max={100}
              text={t("analytics.checkinText", { percent: a.checkin_percent, in: a.checked_in, absent: a.absent })}
            />
          </Block>
          <Block title={t("analytics.campaigns")}>
            {a.campaigns.length === 0 && <p>{t("analytics.noPromos")}</p>}
            {a.campaigns.length > 0 && (
              <Table
                head={[
                  t("manage.col.code"),
                  t("manage.col.name"),
                  t("analytics.redemptions"),
                  t("common.tickets"),
                  t("manage.col.discounts"),
                  t("analytics.netRevenue"),
                ]}
              >
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
