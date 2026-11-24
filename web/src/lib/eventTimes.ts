export const DISPLAY_TIMEZONE = "Asia/Almaty";
const OFFSET = "+05:00";
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

function toDate(date: string, time: string) {
  return new Date(`${date}T${time}:00${OFFSET}`);
}

export function eventRange(input: { dateFrom: string; timeFrom: string; dateTo: string; timeTo: string }) {
  const start = toDate(input.dateFrom, input.timeFrom);
  const end =
    input.dateTo || input.timeTo
      ? toDate(input.dateTo || input.dateFrom, input.timeTo || input.timeFrom)
      : new Date(start.getTime() + DEFAULT_DURATION_MS);
  return { starts_at: start.toISOString(), ends_at: end.toISOString(), valid: end > start };
}

export function localParts(iso: string) {
  const local = new Date(iso).toLocaleString("sv-SE", { timeZone: DISPLAY_TIMEZONE });
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const { date, time } = localParts(iso);
  return `${date}T${time}`;
}

export function fromLocalInput(value: string) {
  return value ? new Date(`${value}:00${OFFSET}`).toISOString() : null;
}
