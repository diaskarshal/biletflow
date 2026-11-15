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
