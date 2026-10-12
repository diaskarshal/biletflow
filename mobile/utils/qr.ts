// Admission-ticket QR codes contain the raw ticket token, which the backend generates as
// "T_" + random string (backend/app/modules/tickets/service.py). Campaign/promo QR codes
// are HTTPS links instead. The scanner must never treat a promo QR as admission (SRS §4.14),
// so anything that is not a ticket token is rejected here, before any network call.
export const TICKET_TOKEN_PREFIX = "T_";

export type QrClassification =
    | { kind: "ticket"; token: string }
    | { kind: "link" }
    | { kind: "unknown" };

export function classifyQrPayload(payload: string): QrClassification {
    const value = payload.trim();

    if (/^https?:\/\//i.test(value)) {
        return { kind: "link" };
    }
    if (value.startsWith(TICKET_TOKEN_PREFIX) && value.length > TICKET_TOKEN_PREFIX.length) {
        return { kind: "ticket", token: value };
    }
    return { kind: "unknown" };
}
