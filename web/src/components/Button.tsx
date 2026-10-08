import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-dark",
  secondary: "border border-brand bg-white text-brand hover:bg-slate-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
};

export function Button({ variant = "primary", loading = false, className = "", disabled, children, ...rest }: Props) {
  return (
    <button
      className={`rounded-xl px-4 py-2 font-heading transition disabled:opacity-50 ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? "..." : children}
    </button>
  );
}
