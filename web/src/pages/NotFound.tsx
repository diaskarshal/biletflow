import { Link } from "react-router-dom";
import { t } from "../lib/i18n";

export function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="font-heading text-2xl font-bold text-slate-900">{t("notFound.title")}</h1>
      <Link to="/" className="mt-4 inline-block text-brand">
        {t("notFound.home")}
      </Link>
    </div>
  );
}
