// The backend returns timestamps without a zone suffix (e.g. "2026-10-16T20:28:02.404055"),
// and they are UTC. JavaScript would read that as the phone's local time, so mark it as UTC.
// Fractional seconds are cut to 3 digits because the JS engine only guarantees milliseconds.
function parseBackendDate(iso: string): Date {
    const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
    const trimmed = iso.replace(/(\.\d{3})\d+/, "$1");
    return new Date(hasZone ? trimmed : `${trimmed}Z`);
}

// Formats an ISO timestamp in the event's own time zone (e.g. "Asia/Almaty"),
// so door staff see the same time the organizer configured.
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
        // Unknown time zone or no Intl support: fall back to the raw value.
        return iso.slice(0, 16).replace("T", " ");
    }
}
