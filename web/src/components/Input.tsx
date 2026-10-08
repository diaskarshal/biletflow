import type { InputHTMLAttributes } from "react";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      className={`w-full rounded-xl border border-transparent bg-white px-3 py-2 text-brand outline-none focus:border-brand focus:ring-1 focus:ring-brand ${className}`}
      {...rest}
    />
  );
}
