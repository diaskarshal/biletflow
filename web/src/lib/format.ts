import { lang, locale, t, tOptional } from "./i18n";
import type { MessageKey } from "./messages";

export function formatDate(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", timeZone })
    .format(new Date(iso))
    .replace("/", ".");
}

export function formatTime(iso: string, timeZone: string) {
  if (lang() !== "en") {
    return new Intl.DateTimeFormat(locale(), { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(new Date(iso));
  }
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone })
    .format(new Date(iso))
    .replace(":00", "");
}

export function formatPrice(kzt: number) {
  return kzt.toLocaleString(lang() === "en" ? "en-US" : locale());
}

export function priceLabel(prices: number[]) {
  if (prices.length === 0) return t("common.tickets");
  const min = Math.min(...prices);
  if (min === 0 && Math.max(...prices) === 0) return t("common.free");
  return t("common.from", { price: formatPrice(min) });
}

type ApiFailure = {
  error?: { code?: string; message?: string; details?: { errors?: { loc?: (string | number)[]; msg?: string }[] } };
  message?: string;
} | null;

const FIELD_LABELS: Record<string, MessageKey> = {
  email: "common.email",
  password: "common.password",
  full_name: "common.fullName",
};

export function errorMessage(e: unknown, fallback?: string) {
  const err = e as ApiFailure;
  const first = err?.error?.details?.errors?.[0];
  if (first?.msg) {
    const field = first.loc?.at(-1);
    const msg = lang() === "en" ? first.msg.replace(/^Value error, /, "") : t("common.invalid");
    if (typeof field !== "string" || field === "body") return msg;
    const label = lang() === "en" || !FIELD_LABELS[field] ? field.replace(/_/g, " ") : t(FIELD_LABELS[field]);
    return `${label}: ${msg}`;
  }
  const translated = err?.error?.code ? tOptional(`err.${err.error.code}`) : undefined;
  return translated ?? err?.error?.message ?? err?.message ?? fallback ?? t("common.error");
}

export const REFUND_POLICIES = {
  full_until_48h: "Full refund up to 48 hours before the event",
  full_anytime: "Full refund any time before the event",
  no_refunds: "No refunds",
} as const;

export type RefundPolicy = keyof typeof REFUND_POLICIES;

export function refundPolicyLabel(policy: string) {
  return tOptional(`refund.${policy}`) ?? policy;
}

export function formatKzt(kzt: number) {
  return `${formatPrice(kzt)} KZT`;
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(locale(), { dateStyle: "medium", timeStyle: "short" });
}
