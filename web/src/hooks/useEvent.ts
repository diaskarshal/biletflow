import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { components } from "../api/schema";

export type EventWithTypes = components["schemas"]["EventOut"] & {
  ticket_types: components["schemas"]["TicketTypeOut"][];
};

// GET /events/{slug} returns the event without ticket types (the contract says otherwise), so load them separately.
export function useEvent(slug: string) {
  return useQuery({
    queryKey: ["event", slug],
    queryFn: async (): Promise<EventWithTypes> => {
      const { data: event, error } = await api.GET("/api/v1/events/{slug}", { params: { path: { slug } } });
      if (error) throw error;
      const { data: types, error: typesError } = await api.GET("/api/v1/events/{event_id}/ticket-types", {
        params: { path: { event_id: event.id } },
      });
      if (typesError) throw typesError;
      return { ...event, ticket_types: types };
    },
  });
}
