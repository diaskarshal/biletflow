import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const links = [
  { to: "/", label: "Events", end: true },
  { to: "/tickets", label: "My tickets" },
  { to: "/organizer", label: "Organizer" },
  { to: "/support", label: "Support" },
  { to: "/profile", label: "Profile" },
];

// Protected links (My tickets, Organizer, Profile) are always shown; RequireAuth sends guests to login.
// Below lg the links collapse into a menu button.
export function Nav() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const shown = user?.is_admin ? [...links, { to: "/admin", label: "Admin" }] : links;

  return (
    <nav className="sticky top-0 z-40 border-b border-brand-dark bg-brand font-nav text-white">
      <div className="mx-auto flex max-w-6xl items-center px-4 py-5 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-3 text-xl" onClick={() => setOpen(false)}>
          <img src="/logo.png" alt="" className="h-8 w-auto" />
          BiletFlow
        </Link>
        <button
          type="button"
          className="ml-auto -my-2 p-2 lg:hidden"
          aria-expanded={open}
          aria-controls="nav-links"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Close" : "Menu"}
        </button>
        <div
          id="nav-links"
          className={`${open ? "flex" : "hidden"} absolute inset-x-0 top-full z-40 flex-col border-b border-brand-dark bg-brand px-4 pb-4 sm:px-6 lg:static lg:ml-auto lg:flex lg:flex-row lg:gap-4 lg:border-0 lg:p-0 xl:gap-8`}
        >
          {shown.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `py-3 lg:py-0 ${isActive ? "underline underline-offset-8" : ""}`}
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
