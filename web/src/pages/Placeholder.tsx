export function Placeholder({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-heading text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-slate-500">Coming in Week 2+.</p>
    </div>
  );
}
