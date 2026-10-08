export function EventImage({ url, title, className = "" }: { url: string | null; title: string; className?: string }) {
  if (url) {
    return <img src={url} alt={title} className={`object-cover ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center bg-sky p-4 text-center font-heading text-2xl text-brand ${className}`}>
      {title}
    </div>
  );
}
