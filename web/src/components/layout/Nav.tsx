import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { LANGS, lang, setLang, t } from "../../lib/i18n";

// Protected links (My tickets, Organizer, Profile) are always shown; RequireAuth sends guests to login.
// Below md the links collapse into a menu button.
export function Nav() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const links = [
    { to: "/", label: t("nav.events"), end: true },
    { to: "/tickets", label: t("nav.tickets") },
    { to: "/organizer", label: t("nav.organizer") },
    { to: "/support", label: t("nav.support") },
    { to: "/profile", label: t("nav.profile") },
  ];
  const shown = user?.is_admin ? [...links, { to: "/admin", label: t("nav.admin") }] : links;

  return (
    <nav className="relative border-b border-black">
      <div className="mx-auto flex max-w-6xl items-center px-4 py-5 text-black sm:px-6">
        <Link to="/" className="font-heading text-xl" onClick={() => setOpen(false)}>
          BiletFlow
        </Link>
        <div role="group" aria-label={t("nav.language")} className="ml-auto flex gap-2 text-sm md:order-last md:ml-8">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              lang={l.code}
              aria-pressed={lang() === l.code}
              className={lang() === l.code ? "font-bold underline underline-offset-4" : ""}
              onClick={() => setLang(l.code)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ml-3 -my-2 p-2 font-heading md:hidden"
          aria-expanded={open}
          aria-controls="nav-links"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? t("nav.close") : t("nav.menu")}
        </button>
        <div
          id="nav-links"
          className={`${open ? "flex" : "hidden"} absolute inset-x-0 top-full z-40 flex-col border-b border-black bg-white px-4 pb-4 font-heading md:static md:ml-auto md:flex md:flex-row md:gap-8 md:border-0 md:p-0 lg:gap-12`}
        >
          {shown.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `py-3 md:py-0 ${isActive ? "underline underline-offset-8" : ""}`}
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
