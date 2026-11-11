
import { apiRequest } from "./client";

export type SupportCategory =
    | "ticket_delivery"
    | "payment"
    | "refund"
    | "seating"
    | "event_information"
    | "check_in"
    | "account"
    | "activation"
    | "technical";

export type SupportStatus =
    | "open"
    | "in_progress"
    | "waiting_for_customer"
    | "resolved";

export type SupportCase = {
    id: number;
    kind: string;
    category: SupportCategory;
    subject: string;
    status: SupportStatus;
    requester_name: string;
    requester_email: string;
    event_id: number | null;
    event_title: string | null;
    order_id: number | null;
    ticket_id: number | null;
    assignee_id: number | null;
    assignee_name: string | null;
    can_manage: boolean;
    created_at: string;
    updated_at: string;
};

export type SupportMessage = {
    id: number;
    author_name: string;
    from_requester: boolean;
    body: string;
    created_at: string;
};

export type SupportCaseDetail = SupportCase & {
    messages: SupportMessage[];
};

export type CreateSupportCase = {
    kind: "attendee" | "organizer";
    category: SupportCategory;
    subject: string;
    message: string;
    event_id?: number | null;
    order_id?: number | null;
    ticket_id?: number | null;
};

export async function getMySupportCases(): Promise<SupportCase[]> {
    return apiRequest("/api/v1/support/cases");
}

export async function createSupportCase(
    data: CreateSupportCase
): Promise<SupportCaseDetail> {
    return apiRequest("/api/v1/support/cases", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function getSupportCase(
    id: number
): Promise<SupportCaseDetail> {
    return apiRequest(`/api/v1/support/cases/${id}`);
}

export async function sendSupportMessage(
    id: number,
    body: string
): Promise<SupportCaseDetail> {
    return apiRequest(`/api/v1/support/cases/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
    });
}
