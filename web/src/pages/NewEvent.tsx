import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { ErrorState } from "../components/EmptyState";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { DISPLAY_TIMEZONE, eventRange } from "../lib/eventTimes";
import { errorMessage } from "../lib/format";

type TicketRow = { name: string; price: string; slots: string };

const emptyTicket: TicketRow = { name: "", price: "0", slots: "" };
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
          ticket_types,
        },
      });
      if (error) throw error;
      // Unpublished events are invisible to attendees, and there is no publish control in the design yet.
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
      setFormError("The event must end after it starts.");
      return;
    }
    if (tickets.some((t) => Number(t.slots) < 1 || Number(t.price) < 0)) {
      setFormError("Each ticket type needs at least 1 slot and a price of 0 or more.");
      return;
    }
    setFormError(null);
    create.mutate();
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="font-heading text-5xl">New event</h1>
      <form onSubmit={submit} className="mt-10 max-w-3xl space-y-6 rounded-[2.5rem] bg-sky p-12">
        <h2 className="font-heading text-2xl">Event Info</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          <Label text="Event title">
            <Input required className={field} value={form.title} onChange={set("title")} />
          </Label>
          <Label text="Event image (URL)">
            <Input type="url" className={field} value={form.image} onChange={set("image")} />
          </Label>
          <div className="col-span-2">
            <Label text="Event description">
              <Textarea rows={6} className={`rounded-xl ${field}`} value={form.description} onChange={set("description")} />
            </Label>
          </div>
          <div className="col-span-2">
            <Label text="Address">
              <Input className={field} value={form.address} onChange={set("address")} />
            </Label>
          </div>
          <Label text="Date From">
            <Input required type="date" className={field} value={form.dateFrom} onChange={set("dateFrom")} />
          </Label>
          <Label text="Date To (optional)">
            <Input type="date" className={field} value={form.dateTo} onChange={set("dateTo")} />
          </Label>
          <Label text="Time From">
            <Input required type="time" className={field} value={form.timeFrom} onChange={set("timeFrom")} />
          </Label>
          <Label text="Time To (optional)">
            <Input type="time" className={field} value={form.timeTo} onChange={set("timeTo")} />
          </Label>
        </div>

        <h2 className="pt-4 font-heading text-2xl">Tickets</h2>
        {tickets.map((t, i) => (
          <div key={i} className="flex items-end gap-4 rounded-2xl bg-brand p-5 text-on-brand">
            <div className="flex-[2]">
              <Label text="Ticket type name">
                <Input required className={field} value={t.name} onChange={(e) => setTicket(i, "name", e.target.value)} />
              </Label>
            </div>
            <div className="flex-1">
              <Label text="Price">
                <Input
                  required
                  type="number"
                  min={0}
                  className={field}
                  value={t.price}
                  onChange={(e) => setTicket(i, "price", e.target.value)}
                />
              </Label>
            </div>
            <div className="flex-1">
              <Label text="Slots">
                <Input
                  required
                  type="number"
                  min={1}
                  className={field}
                  value={t.slots}
                  onChange={(e) => setTicket(i, "slots", e.target.value)}
                />
              </Label>
            </div>
            {tickets.length > 1 && (
              <button
                type="button"
                aria-label={`Remove ticket type ${i + 1}`}
                className="pb-2 text-2xl"
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
          className="w-full rounded-2xl bg-brand px-8 py-4 text-left font-heading text-xl text-on-brand"
        >
          + Add ticket type
        </button>

        {(formError || create.isError) && (
          <ErrorState message={formError ?? errorMessage(create.error, "Could not create the event")} />
        )}
        <div className="flex justify-end">
          <Button type="submit" loading={create.isPending} className="px-8 py-4 text-xl">
            Confirm and Create
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
