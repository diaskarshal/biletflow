import { apiRequest } from "./client";

export type EventStatus = "draft" | "published" | "cancelled" | "completed";

export type EventItem = {
    id: number;
    slug: string;
    title: string;
    venue_name: string | null;
    starts_at: string;
    ends_at: string;
    display_timezone: string;
    status: EventStatus;
    capacity: number | null;
};

export async function getMyEvents(): Promise<EventItem[]> {
    return apiRequest<EventItem[]>("/api/v1/checkin/events");
}

// Public event listing
export type PublicEvent = {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    venue_address: string | null;
    starts_at: string;
    ends_at: string;
    display_timezone: string;
    cover_image_url: string | null;
};

export type PublicEventsResponse = {
    items: PublicEvent[];
    next_cursor: string | null;
};

export async function getPublicEvents(
    cursor?: string
): Promise<PublicEventsResponse> {
    const params = new URLSearchParams({ limit: "12" });

    if (cursor) {
        params.append("cursor", cursor);
    }

    return apiRequest<PublicEventsResponse>(
        `/api/v1/events?${params.toString()}`
    );
}

// Individual event details
export type PublicEventDetails = PublicEvent & {
    status: EventStatus;
    review_status: string;
    paid_sales_enabled: boolean;
    refund_policy: string;
};

export async function getPublicEventDetails(
    slug: string
): Promise<PublicEventDetails> {
    return apiRequest<PublicEventDetails>(
        `/api/v1/events/${encodeURIComponent(slug)}`
    );
}

// Ticket types and availability
export type TicketType = {
    id: number;
    name: string;
    price_kzt: number;
    quantity_total: number;
    quantity_sold: number;
    quantity_reserved: number;
    sales_start_at: string | null;
    sales_end_at: string | null;
    is_hidden: boolean;
};

export async function getEventTicketTypes(
    eventId: number
): Promise<TicketType[]> {
    return apiRequest<TicketType[]>(
        `/api/v1/events/${eventId}/ticket-types`
    );
}

export function calculateSlots(ticketTypes: TicketType[]) {
    const visibleTypes = ticketTypes.filter((t) => !t.is_hidden);

    const total = visibleTypes.reduce(
        (sum, t) => sum + t.quantity_total,
        0
    );

    const taken = visibleTypes.reduce(
        (sum, t) => sum + t.quantity_sold + t.quantity_reserved,
        0
    );

    return {
        total,
        left: Math.max(total - taken, 0),
    };
}