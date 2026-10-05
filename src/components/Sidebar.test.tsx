import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

/** Renders at a route so the active-group marking can be observed. */
const renderSidebarAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );

const groupToggle = (label: string) =>
  screen.getByRole("button", { name: new RegExp(`^${label}$`, "i") });

const groupPanel = (id: string) =>
  document.getElementById(`sidebar-group-${id}`) as HTMLElement;

beforeEach(() => {
  // The sidebar remembers folded groups per browser; each test starts clean.
  window.localStorage.clear();
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

    it("keeps the community catalogues together without a People link", () => {
      signInAs(["coach"]);

      renderSidebar();

      // Order carries meaning in a sidebar. This pins the grouping rather than a
      // pixel position, so a restyle cannot break it.
      const labels = screen.getAllByRole("link").map((link) => link.textContent?.trim());
      const at = (label: string) => labels.indexOf(label);

      expect(at("Coaches")).toBeGreaterThanOrEqual(0);
      expect(at("Organisations")).toBeGreaterThan(at("Coaches"));
      expect(at("Organisations")).toBeLessThan(at("Groups"));
      expect(screen.queryByRole("link", { name: /^people$/i })).not.toBeInTheDocument();
    });
  });

  describe("the collapsible groups", () => {
    it("opens Development, Community and Assessments by default", () => {
      signInAs(["coach"]);

      renderSidebar();

      expect(groupToggle("Development")).toHaveAttribute("aria-expanded", "true");
      expect(groupToggle("Community")).toHaveAttribute("aria-expanded", "true");
      expect(groupToggle("Assessments")).toHaveAttribute("aria-expanded", "true");
    });

    it("folds a group away when its heading is clicked", async () => {
      signInAs(["coach"]);
      const user = userEvent.setup();

      renderSidebar();
      await user.click(groupToggle("Development"));

      expect(groupToggle("Development")).toHaveAttribute("aria-expanded", "false");
      expect(groupPanel("development")).toHaveAttribute("hidden");
      // The panel stays mounted so `aria-controls` still resolves, but its links
      // must leave the accessibility tree.
      expect(
        screen.queryByRole("link", { name: /^skills$/i }),
      ).not.toBeInTheDocument();
    });

    it("expands the group again on a second click", async () => {
      signInAs(["coach"]);
      const user = userEvent.setup();

      renderSidebar();
      await user.click(groupToggle("Development"));
      await user.click(groupToggle("Development"));

      expect(groupToggle("Development")).toHaveAttribute("aria-expanded", "true");
      expect(groupPanel("development")).not.toHaveAttribute("hidden");
      expect(screen.getByRole("link", { name: /^skills$/i })).toBeInTheDocument();
    });

    it("remembers the folded groups for the next visit", async () => {
      signInAs(["coach"]);
      const user = userEvent.setup();

      const first = renderSidebar();
      await user.click(groupToggle("Community"));
      first.unmount();

      renderSidebar();

      expect(groupToggle("Community")).toHaveAttribute("aria-expanded", "false");
      expect(
        screen.queryByRole("link", { name: /organisations/i }),
      ).not.toBeInTheDocument();
    });

    it("falls back to expanded when the stored state is unusable", () => {
      window.localStorage.setItem("bvb.sidebar.collapsed-groups", "{not json");
      signInAs(["coach"]);

      renderSidebar();

      // A corrupt or foreign payload must never leave the user with no links.
      expect(groupToggle("Development")).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("link", { name: /^skills$/i })).toBeInTheDocument();
    });

    it("marks the group that holds the open page", () => {
      signInAs(["coach"]);

      renderSidebarAt("/skills");

      expect(groupToggle("Development")).toHaveClass("active");
      expect(groupToggle("Community")).not.toHaveClass("active");
    });

    it("shows Development but no staff group to a signed-out visitor", () => {
      renderSidebar();

      expect(groupToggle("Development")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^community$/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^assessments$/i }),
      ).not.toBeInTheDocument();
    });

    it("keeps the staff groups away from a player", () => {
      signInAs(["player"]);

      renderSidebar();

      expect(groupToggle("Development")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^community$/i }),
      ).not.toBeInTheDocument();
    });
  });
});
