import { mediaUrl } from "../api/client";
import { useState } from "react";

export function EventImage({ url, title, className = "" }: { url: string | null; title: string; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (url && url !== failedUrl) {
    return <img src={mediaUrl(url)} alt={title} onError={() => setFailedUrl(url)} className={`object-cover ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center overflow-hidden bg-sky p-4 text-center font-heading text-2xl text-brand ${className}`}>
      <span className="line-clamp-6 break-words">{title}</span>
    </div>
  );
}
