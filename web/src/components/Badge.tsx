import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
};

// Event and ticket statuses mapped to a tone. Unknown values fall back to neutral.
const statusTone: Record<string, BadgeTone> = {
  draft: "neutral",
  published: "success",
  completed: "info",
  cancelled: "danger",
  valid: "success",
  checked_in: "info",
  refunded: "warning",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}
