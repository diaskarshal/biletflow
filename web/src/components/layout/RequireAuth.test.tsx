import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthProvider } from "../../context/AuthContext";
import { RequireAuth } from "./RequireAuth";

function renderAt(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<p>login page</p>} />
          <Route element={<RequireAuth />}>
            <Route path="/organizer" element={<p>organizer page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("RequireAuth", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("redirects anonymous users to login", () => {
    renderAt("/organizer");
    expect(screen.getByText("login page")).toBeTruthy();
  });

  it("renders the page for a logged-in user", () => {
    localStorage.setItem("user", JSON.stringify({ id: 1, email: "a@b.c", full_name: "A" }));
    renderAt("/organizer");
    expect(screen.getByText("organizer page")).toBeTruthy();
  });
});
