import { ApiError } from "../api/client";

// What the door staff sees after a scan (SRS §4.8: valid, invalid, cancelled, refunded, already used).
export type ScanOutcome =
    | { kind: "valid"; attendeeName: string }
    | {
          kind:
              | "already_used"
              | "cancelled"
              | "refunded"
              | "invalid"
              | "not_ticket"
              | "forbidden"
              | "error";
          message: string;
      };

// QR codes that are not admission tickets never reach the server.
export function rejectedQrOutcome(kind: "link" | "unknown"): ScanOutcome {
    if (kind === "link") {
        return {
            kind: "not_ticket",
            message: "This is a link or promo QR code, not an admission ticket.",
        };
    }
    return { kind: "not_ticket", message: "This QR code is not a BiletFlow ticket." };
}

// Maps the backend's error codes from POST /api/v1/checkin (docs/api-contract.md) to a result.
export function outcomeFromError(error: unknown): ScanOutcome {
    if (!(error instanceof ApiError)) {
        return { kind: "error", message: "Something went wrong. Scan again." };
    }

    switch (error.code) {
        case "ALREADY_CHECKED_IN":
            return { kind: "already_used", message: "This ticket has already been used." };
        case "TICKET_CANCELLED":
            return { kind: "cancelled", message: "This ticket has been cancelled." };
        case "TICKET_REFUNDED":
            return { kind: "refunded", message: "This ticket has been refunded." };
        case "TICKET_INVALID":
            return { kind: "invalid", message: error.message };
        case "FORBIDDEN":
            return { kind: "forbidden", message: "You are not assigned to check in for this event." };
        case "NETWORK_ERROR":
            return {
                kind: "error",
                message: "No connection to the server. Nobody was checked in. Scan again to retry.",
            };
        default:
            return { kind: "error", message: error.message };
    }
}
