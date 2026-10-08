import type { TextareaHTMLAttributes } from "react";

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      className={`w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand ${className}`}
      {...rest}
    />
  );
}
