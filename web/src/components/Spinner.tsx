import { t } from "../lib/i18n";

export function Spinner({ label }: { label?: string }) {
  return (
    <div role="status" aria-label={label ?? t("common.loading")} className="flex justify-center p-6">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
    </div>
  );
}
