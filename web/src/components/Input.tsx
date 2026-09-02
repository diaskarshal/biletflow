import type { InputHTMLAttributes } from "react";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      className={`w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand ${className}`}
      {...rest}
    />
  );
}
