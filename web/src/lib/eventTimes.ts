// Events are entered in the display timezone (Asia/Almaty, UTC+5 with no DST).
export const DISPLAY_TIMEZONE = "Asia/Almaty";
const OFFSET = "+05:00";
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

function toDate(date: string, time: string) {
  return new Date(`${date}T${time}:00${OFFSET}`);
}

// "Date To" and "Time To" are optional: with neither the event lasts 2 hours, otherwise the missing part
// falls back to the start date / start time.
export function eventRange(input: { dateFrom: string; timeFrom: string; dateTo: string; timeTo: string }) {
  const start = toDate(input.dateFrom, input.timeFrom);
  const end =
    input.dateTo || input.timeTo
      ? toDate(input.dateTo || input.dateFrom, input.timeTo || input.timeFrom)
      : new Date(start.getTime() + DEFAULT_DURATION_MS);
  return { starts_at: start.toISOString(), ends_at: end.toISOString(), valid: end > start };
}
