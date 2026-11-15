import { apiRequest } from "./client";

export type OrganizerEvent = {
    id: number;
    slug: string;
    title: string;
    starts_at: string;
    ends_at: string;
    display_timezone: string;
    status: "draft" | "published" | "cancelled" | "completed";
    review_status: "pending" | "approved" | "rejected";
    review_note: string | null;
    suspended_at: string | null;
    paid_sales_enabled: boolean;
};

export type NewTicketType = { name: string; price_kzt: number; quantity_total: number };

export type NewEvent = {
    title: string;
    description: string | null;
    venue_name: string | null;
    venue_address: string | null;
    cover_image_url: string | null;
    starts_at: string;
    ends_at: string;
    refund_policy: "full_until_48h" | "full_anytime" | "no_refunds";
    ticket_types: NewTicketType[];
};

export type Activation = {
    fee_kzt: number;
    has_paid_ticket_type: boolean;
    organizer_verified: boolean;
    payout_account_set: boolean;
    terms_accepted: boolean;
    fee_paid: boolean;
    paid_sales_enabled: boolean;
    suspended: boolean;
    pending_payment_id: number | null;
};

export type Analytics = {
    capacity: number;
    sold: number;
    remaining: number;
    gross_kzt: number;
    discount_kzt: number;
    refunds_kzt: number;
    net_kzt: number;
    checked_in: number;
    absent: number;
    checkin_percent: number;
};

export type EventAttendee = {
    ticket_id: number;
    order_id: number;
    order_total_kzt: number;
    attendee_name: string;
    attendee_email: string;
    ticket_type_name: string;
    status: string;
};

export type Campaign = {
    id: number;
    code: string;
    discount_type: "percent" | "fixed";
    discount_value: number;
    redemptions: number;
    max_redemptions: number | null;
    disabled: boolean;
    net_kzt: number;
};

const post = <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const getOrganizerEvents = () => apiRequest<OrganizerEvent[]>("/api/v1/organizer/events");

export async function createEvent(data: NewEvent): Promise<OrganizerEvent> {
    const event = await post<OrganizerEvent>("/api/v1/events", data);
    return post<OrganizerEvent>(`/api/v1/events/${event.id}/publish`);
}

export const publishEvent = (id: number) => post<OrganizerEvent>(`/api/v1/events/${id}/publish`);
export const unpublishEvent = (id: number) => post<OrganizerEvent>(`/api/v1/events/${id}/unpublish`);
export const cancelEvent = (id: number) => post<OrganizerEvent>(`/api/v1/events/${id}/cancel`);
export const getActivation = (id: number) => apiRequest<Activation>(`/api/v1/events/${id}/activation`);
export const acceptTerms = (id: number) => post<Activation>(`/api/v1/events/${id}/activation/terms`);
export const payActivation = (id: number) => post<{ payment_id: number }>(`/api/v1/events/${id}/activation/payment`);
export const getAnalytics = (id: number) => apiRequest<Analytics>(`/api/v1/events/${id}/analytics`);
export const getAttendees = (id: number) => apiRequest<EventAttendee[]>(`/api/v1/events/${id}/attendees`);
export const refundOrder = (orderId: number) => post<unknown>(`/api/v1/orders/${orderId}/cancel`);
export const addStaff = (id: number, email: string) =>
    post<unknown>(`/api/v1/events/${id}/staff`, { email, role: "event_admin" });
export const getCampaigns = (id: number) => apiRequest<Campaign[]>(`/api/v1/events/${id}/campaigns`);
export const createCampaign = (id: number, body: { name: string; code: string | null; discount_type: "percent" | "fixed"; discount_value: number }) =>
    post<Campaign>(`/api/v1/events/${id}/campaigns`, body);
