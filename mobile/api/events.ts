import { API_URL, apiRequest } from "./client";

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
    cursor?: string,
    q?: string
): Promise<PublicEventsResponse> {
    const params = new URLSearchParams({ limit: "12" });

    if (q) {
        params.append("q", q);
    }

    if (cursor) {
        params.append("cursor", cursor);
    }

    return apiRequest<PublicEventsResponse>(
        `/api/v1/events?${params.toString()}`
    );
}

export type PublicEventDetails = PublicEvent & {
    status: EventStatus;
    category: string | null;
    registration_opens_at: string | null;
    registration_closes_at: string | null;
    review_status: string;
    paid_sales_enabled: boolean;
    refund_policy: string;
};

export const calendarFileUrl = (slug: string) => `${API_URL}/api/v1/events/${encodeURIComponent(slug)}/calendar.ics`;

const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, "");

export function googleCalendarUrl(event: PublicEvent) {
    return `https://calendar.google.com/calendar/render?${new URLSearchParams({
        action: "TEMPLATE",
        text: event.title,
        dates: `${utc(event.starts_at)}/${utc(event.ends_at)}`,
        ctz: event.display_timezone,
        details: event.description ?? "",
        location: event.venue_address ?? "",
    })}`;
}

export async function getPublicEventDetails(
    slug: string
): Promise<PublicEventDetails> {
    return apiRequest<PublicEventDetails>(
        `/api/v1/events/${encodeURIComponent(slug)}`
    );
}

export type TicketType = {
    id: number;
    name: string;
    description: string | null;
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
export async function reportEvent(eventId: number, reason: string): Promise<void> {
    await apiRequest<void>(`/api/v1/events/${eventId}/report`, {
        method: "POST",
        body: JSON.stringify({ reason }),
    });
}
