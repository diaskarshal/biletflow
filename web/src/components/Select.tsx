import type { SelectHTMLAttributes } from "react";

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return (
    <select
      className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand ${className}`}
      {...rest}
    />
  );
}
