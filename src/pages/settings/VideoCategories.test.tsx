import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { api, type VideoCategory } from "../../api";
import VideoCategories from "./VideoCategories";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: {
      adminVideoCategories: vi.fn(),
      adminCreateVideoCategory: vi.fn(),
      adminUpdateVideoCategory: vi.fn(),
      adminDestroyVideoCategory: vi.fn(),
    },
  };
});

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, name: "Admin", email_address: "a@b.c", roles: ["admin"] },
  }),
}));

const mockedApi = vi.mocked(api, true);

const categories: VideoCategory[] = [
  {
    id: 1,
    name: "Serve",
    slug: "serve",
    description: "Serving clips",
    position: 0,
    video_count: 3,
    created_at: "",
    updated_at: "",
  },
  {
    id: 2,
    name: "Block",
    slug: "block",
    description: null,
    position: 1,
    video_count: 0,
    created_at: "",
    updated_at: "",
  },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <VideoCategories />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.adminVideoCategories.mockResolvedValue(categories);
});

afterEach(cleanup);

describe("VideoCategories settings page", () => {
  it("lists categories with position and usage count", async () => {
    renderPage();

    expect(await screen.findByText("Serve")).toBeInTheDocument();
    expect(screen.getByText("Serving clips")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Block")).toBeInTheDocument();
  });

  it("creates a category from the new-category form", async () => {
    mockedApi.adminCreateVideoCategory.mockResolvedValue(categories[0]);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /new category/i }));
    await user.type(screen.getByLabelText(/name/i), "Defense");
    await user.click(screen.getByRole("button", { name: /create category/i }));

    expect(mockedApi.adminCreateVideoCategory).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Defense" }),
    );
  });

  it("edits a category inline and submits the changed fields", async () => {
    mockedApi.adminUpdateVideoCategory.mockResolvedValue(categories[0]);
    const user = userEvent.setup();
    renderPage();

    const serveRow = (await screen.findByText("Serve")).closest("tr");
    await user.click(within(serveRow as HTMLElement).getByRole("button", { name: /edit/i }));
    const nameInput = screen.getByLabelText(/name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Serving");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(mockedApi.adminUpdateVideoCategory).toHaveBeenCalledWith(1, {
      name: "Serving",
      description: "Serving clips",
      position: 0,
    });
  });

  it("deletes a category after confirmation", async () => {
    const user = userEvent.setup();
    renderPage();

    const serveRow = (await screen.findByText("Serve")).closest("tr");
    await user.click(within(serveRow as HTMLElement).getByRole("button", { name: /delete/i }));
    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    expect(mockedApi.adminDestroyVideoCategory).toHaveBeenCalledWith(1);
  });
});
