import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Sidebar from "./Sidebar";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("../auth/TestAccessContext", () => ({
  useTestAccess: () => ({ exit: vi.fn() }),
}));

let authState: {
  user: { roles?: string[]; email_address?: string; name?: string } | null;
  impersonation: { active: boolean; realAdmin: unknown };
  logout: () => void;
  stopImpersonating: () => void;
} = {
  user: null,
  impersonation: { active: false, realAdmin: null },
  logout: vi.fn(),
  stopImpersonating: vi.fn(),
};

const signInAs = (roles: string[]) => {
  authState = {
    ...authState,
    user: {
      email_address: `${roles[0]}@example.com`,
      name: roles[0],
      roles,
    },
  };
};

const renderSidebar = () =>
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  );

beforeEach(() => {
  authState = {
    user: null,
    impersonation: { active: false, realAdmin: null },
    logout: vi.fn(),
    stopImpersonating: vi.fn(),
  };
});

describe("Sidebar", () => {
  describe("the Organisations link", () => {
    it.each(["coach", "curator", "admin"])("appears for a %s", (role) => {
      // The page requires a training manager, so the link belongs to the staff
      // group and must not be offered to somebody who would only get a 403.
      signInAs([role]);

      renderSidebar();

      expect(screen.getByRole("link", { name: /organisations/i })).toBeInTheDocument();
    });

    it("links to the page it navigates to", () => {
      signInAs(["coach"]);

      renderSidebar();

      expect(screen.getByRole("link", { name: /organisations/i })).toHaveAttribute(
        "href",
        "/organisations",
      );
    });

    it("is hidden from a player", () => {
      signInAs(["player"]);

      renderSidebar();

      expect(screen.queryByRole("link", { name: /organisations/i })).not.toBeInTheDocument();
    });

    it("is hidden from a signed-out visitor", () => {
      renderSidebar();

      expect(screen.queryByRole("link", { name: /organisations/i })).not.toBeInTheDocument();
    });

    it("sits with the other people-facing pages, between Coaches and Groups", () => {
      signInAs(["coach"]);

      renderSidebar();

      // Order carries meaning in a sidebar. This pins the grouping rather than a
      // pixel position, so a restyle cannot break it.
      const labels = screen.getAllByRole("link").map((link) => link.textContent?.trim());
      const at = (label: string) => labels.indexOf(label);

      expect(at("Coaches")).toBeGreaterThanOrEqual(0);
      expect(at("Organisations")).toBeGreaterThan(at("Coaches"));
      expect(at("Organisations")).toBeLessThan(at("Groups"));
    });
  });
});
