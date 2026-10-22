import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export function useOrganizerEvents() {
  return useQuery({
    queryKey: ["organizer-events"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/organizer/events");
      if (error) throw error;
      return data;
    },
  });
}
