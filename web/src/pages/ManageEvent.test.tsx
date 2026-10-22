import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const event = {
  id: 7,
  slug: "mvp-demo",
  title: "MVP Demo",
  status: "published",
  starts_at: "2026-12-01T13:00:00Z",
  ends_at: "2026-12-01T15:00:00Z",
  refund_policy: "full_until_48h",
  display_timezone: "Asia/Almaty",
};

afterEach(() => vi.unstubAllGlobals());

it("lists attendees and adds door staff", async () => {
  const staff: object[] = [];
  const posted: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (req: Request) => {
    const path = new URL(req.url).pathname;
    if (path === "/api/v1/organizer/events") return Response.json([event]);
    if (path === "/api/v1/events/7/attendees") {
      return Response.json([
        { ticket_id: 1, attendee_name: "Aigerim", attendee_email: "a@test.kz", ticket_type_name: "General", status: "checked_in" },
      ]);
    }
    if (path === "/api/v1/events/7/staff" && req.method === "POST") {
      const body = await req.json();
      posted.push(body);
      staff.push({ id: 1, event_id: 7, user_id: 2, email: body.email, full_name: "Door Staff", role: body.role, created_at: event.starts_at });
      return Response.json(staff[0], { status: 201 });
    }
    if (path === "/api/v1/events/7/staff") return Response.json(staff);
    return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }));
  vi.resetModules();
  const { ManageEvent } = await import("./ManageEvent");

  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/organizer/events/7"]}>
        <Routes>
          <Route path="/organizer/events/:id" element={<ManageEvent />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  expect(await screen.findByText("Aigerim", {}, { timeout: 5000 })).toBeTruthy();
  expect(screen.getByText("1 of 1 checked in")).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Staff email"), { target: { value: "door@test.kz" } });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));

  expect(await screen.findByText("Door Staff (door@test.kz)", {}, { timeout: 5000 })).toBeTruthy();
  expect(posted).toEqual([{ email: "door@test.kz", role: "event_admin" }]);
});
