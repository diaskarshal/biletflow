import { fromLocalInput, toLocalInput } from "../lib/eventTimes";
import { t } from "../lib/i18n";
import type { MessageKey } from "../lib/messages";
import { Input } from "./Input";

export const CATEGORIES = ["concert", "conference", "workshop", "sports", "theatre", "meetup", "festival", "other"] as const;
const VISIBILITIES = ["public", "unlisted", "private"] as const;

type Category = (typeof CATEGORIES)[number];
type Visibility = (typeof VISIBILITIES)[number];

export type Settings = { category: string; visibility: string; capacity: string; regOpens: string; regCloses: string };

export function settingsFrom(event?: {
  category: string | null;
  visibility: string;
  capacity: number | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
}): Settings {
  return {
    category: event?.category ?? "",
    visibility: event?.visibility ?? "public",
    capacity: event?.capacity ? String(event.capacity) : "",
    regOpens: toLocalInput(event?.registration_opens_at),
    regCloses: toLocalInput(event?.registration_closes_at),
  };
}

export function settingsBody(s: Settings) {
  return {
    category: (s.category || null) as Category | null,
    visibility: s.visibility as Visibility,
    capacity: s.capacity ? Number(s.capacity) : null,
    registration_opens_at: fromLocalInput(s.regOpens),
    registration_closes_at: fromLocalInput(s.regCloses),
  };
}

export const settingsValid = (s: Settings) => !s.regOpens || !s.regCloses || s.regCloses > s.regOpens;

export function EventSettings({ value, onChange, field }: { value: Settings; onChange: (s: Settings) => void; field: string }) {
  const set = (key: keyof Settings) => (e: { target: { value: string } }) => onChange({ ...value, [key]: e.target.value });
  const select = `w-full rounded-xl border border-slate-400 bg-white px-3 py-2 text-brand`;
  return (
    <>
      <label className="block space-y-1">
        <span className="block">{t("form.category")}</span>
        <select className={select} value={value.category} onChange={set("category")}>
          <option value="">{t("form.noCategory")}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`category.${c}` as MessageKey)}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="block">{t("form.visibility")}</span>
        <select className={select} value={value.visibility} onChange={set("visibility")}>
          {VISIBILITIES.map((v) => (
            <option key={v} value={v}>
              {t(`visibility.${v}` as MessageKey)}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="block">{t("form.capacity")}</span>
        <Input type="number" min={1} className={field} value={value.capacity} onChange={set("capacity")} />
        <span className="block text-sm">{t("form.capacityHint")}</span>
      </label>
      <div />
      <label className="block space-y-1">
        <span className="block">{t("form.regOpens")}</span>
        <Input type="datetime-local" className={field} value={value.regOpens} onChange={set("regOpens")} />
      </label>
      <label className="block space-y-1">
        <span className="block">{t("form.regCloses")}</span>
        <Input type="datetime-local" className={field} value={value.regCloses} onChange={set("regCloses")} />
      </label>
      {!settingsValid(value) && <p className="text-red-700 sm:col-span-2">{t("form.regWindow")}</p>}
    </>
  );
}
