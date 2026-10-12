import { apiRequest } from "./client";

export type CheckinResult = {
    ticket_id: number;
    attendee_name: string;
    checked_in_at: string;
};

// One call that both validates the ticket and checks it in (docs/api-contract.md).
// Failures arrive as ApiError with codes: TICKET_INVALID, TICKET_CANCELLED, TICKET_REFUNDED,
// ALREADY_CHECKED_IN, FORBIDDEN.
export async function checkInTicket(qrToken: string, eventId: number): Promise<CheckinResult> {
    return apiRequest<CheckinResult>("/api/v1/checkin", {
        method: "POST",
        body: JSON.stringify({ qr_token: qrToken, event_id: eventId }),
    });
}
