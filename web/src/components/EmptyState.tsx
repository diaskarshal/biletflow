import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center">
      <p className="font-heading text-lg font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
      {message}
    </p>
  );
}
