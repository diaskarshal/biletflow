export function formatDate(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", timeZone })
    .format(new Date(iso))
    .replace("/", ".");
}

export function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone })
    .format(new Date(iso))
    .replace(":00", "");
}

export function formatPrice(kzt: number) {
  return kzt.toLocaleString("en-US");
}

export function priceLabel(prices: number[]) {
  if (prices.length === 0) return "Tickets";
  const min = Math.min(...prices);
  if (min === 0 && Math.max(...prices) === 0) return "Free";
  return `from ${formatPrice(min)}`;
}

export function errorMessage(e: unknown, fallback = "Something went wrong") {
  const err = e as { error?: { message?: string }; message?: string } | null;
  return err?.error?.message ?? err?.message ?? fallback;
}

export const REFUND_POLICIES = {
  full_until_48h: "Full refund up to 48 hours before the event",
  full_anytime: "Full refund any time before the event",
  no_refunds: "No refunds",
} as const;

export type RefundPolicy = keyof typeof REFUND_POLICIES;

export function formatKzt(kzt: number) {
  return `${formatPrice(kzt)} KZT`;
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}
