import { apiRequest } from "./client";

export type EventStatus = "draft" | "published" | "cancelled" | "completed";

// Subset of the backend's EventOut that the app uses.
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
