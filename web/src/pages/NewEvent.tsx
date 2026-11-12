import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { ErrorState } from "../components/EmptyState";
import { CoverUpload } from "../components/CoverUpload";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { DISPLAY_TIMEZONE, eventRange } from "../lib/eventTimes";
import { errorMessage, REFUND_POLICIES, refundPolicyLabel, type RefundPolicy } from "../lib/format";
import { t } from "../lib/i18n";

type TicketRow = { name: string; price: string; slots: string; limit: string };

const emptyTicket: TicketRow = { name: "", price: "0", slots: "", limit: "" };
// Light grey fields on the blue card, per the design.
const field = "bg-on-brand!";

export function NewEvent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    image: "",
    description: "",
    address: "",
    dateFrom: "",
    dateTo: "",
    timeFrom: "",
    timeTo: "",
    refundPolicy: "full_until_48h" as RefundPolicy,
  });
  const [tickets, setTickets] = useState<TicketRow[]>([{ ...emptyTicket }]);
  const [formError, setFormError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const range = eventRange(form);
      const ticket_types = tickets.map((t) => ({
        name: t.name.trim(),
        price_kzt: Number(t.price),
        quantity_total: Number(t.slots),
        max_per_order: t.limit ? Number(t.limit) : null,
        is_hidden: false,
      }));
      const { data: event, error } = await api.POST("/api/v1/events", {
        body: {
          title: form.title.trim(),
          description: form.description.trim() || null,
          venue_address: form.address.trim() || null,
          cover_image_url: form.image.trim() || null,
          starts_at: range.starts_at,
          ends_at: range.ends_at,
          display_timezone: DISPLAY_TIMEZONE,
          visibility: "public",
          capacity: ticket_types.reduce((n, t) => n + t.quantity_total, 0),
          refund_policy: form.refundPolicy,
          ticket_types,
        },
      });
      if (error) throw error;
      const { error: publishError } = await api.POST("/api/v1/events/{event_id}/publish", {
        params: { path: { event_id: event.id } },
      });
      if (publishError) throw publishError;
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizer-events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      navigate("/organizer");
    },
  });

  function set(name: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [name]: e.target.value }));
  }

  function setTicket(i: number, name: keyof TicketRow, value: string) {
    setTickets((rows) => rows.map((r, j) => (j === i ? { ...r, [name]: value } : r)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventRange(form).valid) {
      setFormError(t("form.endAfterStart"));
      return;
    }
    if (tickets.some((t) => Number(t.slots) < 1 || Number(t.price) < 0)) {
      setFormError(t("newEvent.ticketRules"));
      return;
    }
    if (tickets.some((t) => t.limit && Number(t.limit) < 1)) {
      setFormError(t("newEvent.limitRule"));
      return;
    }
    setFormError(null);
    create.mutate();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="font-heading text-3xl sm:text-5xl">{t("newEvent.title")}</h1>
      <form onSubmit={submit} className="mt-6 max-w-3xl space-y-6 rounded-3xl bg-sky p-5 sm:mt-10 sm:rounded-[2.5rem] sm:p-12">
        <h2 className="font-heading text-2xl">{t("newEvent.info")}</h2>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          <Label text={t("newEvent.eventTitle")}>
            <Input required className={field} value={form.title} onChange={set("title")} />
          </Label>
          <div className="space-y-2">
            <span className="block text-lg">{t("newEvent.image")}</span>
            <CoverUpload value={form.image} onChange={(image) => setForm((f) => ({ ...f, image }))} />
          </div>
          <div className="sm:col-span-2">
            <Label text={t("newEvent.description")}>
              <Textarea rows={6} className={`rounded-xl ${field}`} value={form.description} onChange={set("description")} />
            </Label>
          </div>
          <div className="sm:col-span-2">
            <Label text={t("form.address")}>
              <Input className={field} value={form.address} onChange={set("address")} />
            </Label>
          </div>
          <Label text={t("newEvent.dateFrom")}>
            <Input required type="date" className={field} value={form.dateFrom} onChange={set("dateFrom")} />
          </Label>
          <Label text={t("newEvent.dateTo")}>
            <Input type="date" className={field} value={form.dateTo} onChange={set("dateTo")} />
          </Label>
          <Label text={t("newEvent.timeFrom")}>
            <Input required type="time" className={field} value={form.timeFrom} onChange={set("timeFrom")} />
          </Label>
          <Label text={t("newEvent.timeTo")}>
            <Input type="time" className={field} value={form.timeTo} onChange={set("timeTo")} />
          </Label>
          <div className="sm:col-span-2">
            <Label text={t("form.refundPolicy")}>
              <select
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-brand"
                value={form.refundPolicy}
                onChange={(e) => setForm((f) => ({ ...f, refundPolicy: e.target.value as RefundPolicy }))}
              >
                {Object.keys(REFUND_POLICIES).map((value) => (
                  <option key={value} value={value}>
                    {refundPolicyLabel(value)}
                  </option>
                ))}
              </select>
            </Label>
          </div>
        </div>

        <h2 className="pt-4 font-heading text-2xl">{t("common.tickets")}</h2>
        {tickets.map((ticket, i) => (
          <div key={i} className="relative grid grid-cols-2 gap-3 rounded-2xl bg-brand p-4 text-on-brand sm:flex sm:items-end sm:gap-4 sm:p-5">
            <div className="col-span-2 pr-8 sm:flex-[2] sm:pr-0">
              <Label text={t("newEvent.typeName")}>
                <Input required className={field} value={ticket.name} onChange={(e) => setTicket(i, "name", e.target.value)} />
              </Label>
            </div>
            <div className="sm:flex-1">
              <Label text={t("form.price")}>
                <Input
                  required
                  type="number"
                  min={0}
                  className={field}
                  value={ticket.price}
                  onChange={(e) => setTicket(i, "price", e.target.value)}
                />
              </Label>
            </div>
            <div className="sm:flex-1">
              <Label text={t("common.slots")}>
                <Input
                  required
                  type="number"
                  min={1}
                  className={field}
                  value={ticket.slots}
                  onChange={(e) => setTicket(i, "slots", e.target.value)}
                />
              </Label>
            </div>
            <div className="sm:flex-1">
              <Label text={t("form.maxPerPerson")}>
                <Input
                  type="number"
                  min={1}
                  placeholder={t("form.noLimit")}
                  className={field}
                  value={ticket.limit}
                  onChange={(e) => setTicket(i, "limit", e.target.value)}
                />
              </Label>
            </div>
            {tickets.length > 1 && (
              <button
                type="button"
                aria-label={t("newEvent.removeType", { n: i + 1 })}
                className="absolute top-2 right-3 p-1 text-2xl sm:static sm:pb-2"
                onClick={() => setTickets((rows) => rows.filter((_, j) => j !== i))}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setTickets((rows) => [...rows, { ...emptyTicket }])}
          className="w-full rounded-2xl bg-brand px-5 py-4 text-left font-heading text-lg text-on-brand sm:px-8 sm:text-xl"
        >
          {t("newEvent.addType")}
        </button>

        {(formError || create.isError) && (
          <ErrorState message={formError ?? errorMessage(create.error, t("newEvent.failed"))} />
        )}
        <div className="flex justify-end">
          <Button type="submit" loading={create.isPending} className="w-full px-8 py-4 text-xl sm:w-auto">
            {t("newEvent.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="block text-lg">{text}</span>
      {children}
    </label>
  );
}
