import { ApiError } from "../api/client";
import { t } from "../i18n";

export type ScanOutcome =
    | { kind: "valid"; attendeeName: string; ticketId: number }
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

export function rejectedQrOutcome(kind: "link" | "unknown"): ScanOutcome {
    if (kind === "link") {
        return {
            kind: "not_ticket",
            message: t("scan.msgLink"),
        };
    }
    return { kind: "not_ticket", message: t("scan.msgUnknown") };
}

export function outcomeFromError(error: unknown): ScanOutcome {
    if (!(error instanceof ApiError)) {
        return { kind: "error", message: t("scan.msgError") };
    }

    switch (error.code) {
        case "ALREADY_CHECKED_IN":
            return { kind: "already_used", message: t("scan.msgUsed") };
        case "TICKET_CANCELLED":
            return { kind: "cancelled", message: t("scan.msgCancelled") };
        case "TICKET_REFUNDED":
            return { kind: "refunded", message: t("scan.msgRefunded") };
        case "TICKET_INVALID":
            return { kind: "invalid", message: t(error.status === 404 ? "scan.msgNotFound" : "scan.msgWrongEvent") };
        case "TICKET_UNPAID":
            return { kind: "invalid", message: t("scan.msgUnpaid") };
        case "FORBIDDEN":
            return { kind: "forbidden", message: t("scan.msgForbidden") };
        case "NETWORK_ERROR":
            return {
                kind: "error",
                message: t("scan.msgNetwork"),
            };
        default:
            return { kind: "error", message: error.message };
    }
}
