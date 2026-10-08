import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-heading text-2xl font-bold text-slate-900">Page not found</h1>
      <Link to="/" className="mt-4 inline-block text-brand">
        Back to home
      </Link>
    </div>
  );
}
