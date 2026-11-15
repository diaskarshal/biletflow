function parseBackendDate(iso: string): Date {
    const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
    const trimmed = iso.replace(/(\.\d{3})\d+/, "$1");
    return new Date(hasZone ? trimmed : `${trimmed}Z`);
}

export function formatEventDate(iso: string, timeZone: string): string {
    const date = parseBackendDate(iso);
    try {
        return date.toLocaleString("en-GB", {
            timeZone,
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return iso.slice(0, 16).replace("T", " ");
    }
}
