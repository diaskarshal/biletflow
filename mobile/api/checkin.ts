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

export type CheckinSummary = {
    registered: number;
    checked_in: number;
};

export type Attendee = {
    ticket_id: number;
    attendee_name: string;
    attendee_email: string;
    ticket_type_name: string;
    status: string;
};

export function getSummary(eventId: number): Promise<CheckinSummary> {
    return apiRequest<CheckinSummary>(`/api/v1/checkin/events/${eventId}/summary`);
}

export function searchAttendees(eventId: number, query: string): Promise<Attendee[]> {
    return apiRequest<Attendee[]>(
        `/api/v1/checkin/events/${eventId}/attendees?q=${encodeURIComponent(query)}`
    );
}

export function checkInById(ticketId: number, eventId: number): Promise<CheckinResult> {
    return apiRequest<CheckinResult>(`/api/v1/checkin/tickets/${ticketId}`, {
        method: "POST",
        body: JSON.stringify({ event_id: eventId }),
    });
}

export function undoCheckIn(ticketId: number, eventId: number): Promise<void> {
    return apiRequest<void>(`/api/v1/checkin/tickets/${ticketId}/undo`, {
        method: "POST",
        body: JSON.stringify({ event_id: eventId }),
    });
}
