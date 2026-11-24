import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { components } from "../api/schema";

export type EventWithTypes = components["schemas"]["EventOut"] & {
  ticket_types: components["schemas"]["TicketTypeOut"][];
};

export function useEvent(slug: string, key?: string | null) {
  return useQuery({
    queryKey: ["event", slug, key],
    queryFn: async (): Promise<EventWithTypes> => {
      const { data: event, error } = await api.GET("/api/v1/events/{slug}", {
        params: { path: { slug }, query: { key: key ?? undefined } },
      });
      if (error) throw error;
      const { data: types, error: typesError } = await api.GET("/api/v1/events/{event_id}/ticket-types", {
        params: { path: { event_id: event.id } },
      });
      if (typesError) throw typesError;
      return { ...event, ticket_types: types };
    },
  });
}
