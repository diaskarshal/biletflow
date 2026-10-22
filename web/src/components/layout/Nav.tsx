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
export function Nav() {
  const { user } = useAuth();
  const shown = user?.is_admin ? [...links, { to: "/admin", label: "Admin" }] : links;
  return (
    <nav className="border-b border-black">
      <div className="mx-auto flex max-w-6xl items-center px-6 py-5 text-black">
        <Link to="/" className="font-heading text-xl">
          BiletFlow
        </Link>
        <div className="ml-auto flex gap-12 font-heading">
          {shown.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => (isActive ? "underline underline-offset-8" : "")}
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
