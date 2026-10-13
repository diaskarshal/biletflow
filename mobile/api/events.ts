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

// TODO(backend): GET /api/v1/organizer/events only returns events the user OWNS.
// An Event Admin added through POST /events/{id}/staff cannot list their assigned
// events yet. When an "assigned events" endpoint exists, only this function changes.
export async function getMyEvents(): Promise<EventItem[]> {
    return apiRequest<EventItem[]>("/api/v1/organizer/events");
}
