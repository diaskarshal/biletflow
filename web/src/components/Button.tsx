import type { ButtonHTMLAttributes } from "react";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      className={`rounded-md bg-brand px-4 py-2 font-medium text-white transition hover:bg-brand-dark disabled:opacity-50 ${className}`}
      {...rest}
    />
  );
}
