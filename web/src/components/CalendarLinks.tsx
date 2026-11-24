import { baseUrl } from "../api/client";
import type { components } from "../api/schema";
import { t } from "../lib/i18n";

type EventOut = components["schemas"]["EventOut"];

const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, "");

export function CalendarLinks({ event }: { event: EventOut }) {
  const page = `${window.location.origin}/events/${event.slug}${event.visibility === "private" ? window.location.search : ""}`;
  const details = [event.description, page].filter(Boolean).join("\n\n");
  const location = [event.venue_name, event.venue_address].filter(Boolean).join(", ");
  const key = new URLSearchParams(window.location.search).get("key");
  const ics = `${baseUrl}/api/v1/events/${event.slug}/calendar.ics${key ? `?key=${key}` : ""}`;
  const icsAllowed = event.visibility !== "private" || !!key;
  const google = `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${utc(event.starts_at)}/${utc(event.ends_at)}`,
    ctz: event.display_timezone,
    details,
    location,
  })}`;
  const outlook = `https://outlook.live.com/calendar/0/action/compose?${new URLSearchParams({
    subject: event.title,
    startdt: new Date(event.starts_at).toISOString(),
    enddt: new Date(event.ends_at).toISOString(),
    body: details,
    location,
  })}`;

  if (event.status === "cancelled") {
    if (!icsAllowed) return null;
    return (
      <p className="mt-2">
        <a className="underline" href={ics}>
          {t("cal.cancelled")}
        </a>
      </p>
    );
  }
  return (
    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      <span>{t("cal.add")}</span>
      <a className="underline" href={google} target="_blank" rel="noreferrer">
        Google Calendar
      </a>
      <a className="underline" href={outlook} target="_blank" rel="noreferrer">
        Outlook.com
      </a>
      {icsAllowed && (
        <a className="underline" href={ics}>
          {t("cal.ics")}
        </a>
      )}
    </p>
  );
}
