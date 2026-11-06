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
// Below md the links collapse into a menu button.
export function Nav() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const shown = user?.is_admin ? [...links, { to: "/admin", label: "Admin" }] : links;

  return (
    <nav className="relative border-b border-black">
      <div className="mx-auto flex max-w-6xl items-center px-4 py-5 text-black sm:px-6">
        <Link to="/" className="font-heading text-xl" onClick={() => setOpen(false)}>
          BiletFlow
        </Link>
        <button
          type="button"
          className="ml-auto -my-2 p-2 font-heading md:hidden"
          aria-expanded={open}
          aria-controls="nav-links"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Close" : "Menu"}
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
