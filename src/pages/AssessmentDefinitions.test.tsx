import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type AssessmentDefinition, type Category, type CategoryCustom } from "../api";
import { paginated } from "../test/paginated";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import AssessmentDefinitions from "./AssessmentDefinitions";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      assessmentDefinitions: vi.fn(),
      categories: vi.fn(),
      categoryCustoms: vi.fn(),
      createCategoryCustom: vi.fn(),
      createAssessmentDefinition: vi.fn(),
      updateAssessmentDefinition: vi.fn(),
      archiveAssessmentDefinition: vi.fn(),
      restoreAssessmentDefinition: vi.fn(),
      deleteAssessmentDefinition: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const categories: Category[] = [
  { id: 1, name: "Attack", slug: "attack" },
  { id: 2, name: "Defense", slug: "defense" },
];

const definition = (overrides: Partial<AssessmentDefinition> = {}): AssessmentDefinition => ({
  id: 10,
  name: "A-Level",
  description: null,
  status: "draft",
  created_by_id: 1,
  created_at: "",
  updated_at: "",
  total_weight: 100,
  remaining_weight: 0,
  weights_balanced: true,
  referenced: false,
  assessment_categories: [
    {
      id: 11,
      category_id: 1,
      category_custom_id: null,
      source_type: "category",
      label: "Attack",
      weight: 100,
      position: 0,
      category: categories[0],
      category_custom: null,
    },
  ],
  ...overrides,
});

// Retirement is admin-only, so the page reads the signed-in user. Defaults to a
// non-admin, which is what most of these tests are.
const authValue = (overrides: Partial<AuthContextValue> = {}): AuthContextValue => ({
  user: null,
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  impersonation: { active: false, realAdmin: null },
  startImpersonating: vi.fn(),
  stopImpersonating: vi.fn(),
  ...overrides,
});

const adminUser = {
  id: 1,
  email: "admin@example.com",
  roles: ["admin"],
} as unknown as AuthContextValue["user"];

const renderPage = (auth: AuthContextValue = authValue()) =>
  render(
    <AuthContext.Provider value={auth}>
      <AssessmentDefinitions />
    </AuthContext.Provider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.assessmentDefinitions.mockResolvedValue(paginated([]));
  mockedApi.categories.mockResolvedValue(categories);
  mockedApi.categoryCustoms.mockResolvedValue([]);
  mockedApi.createCategoryCustom.mockResolvedValue({ id: 20, name: "Communication", visibility: "shared" } satisfies CategoryCustom);
  mockedApi.createAssessmentDefinition.mockResolvedValue(definition());
});

describe("AssessmentDefinitions", () => {
  it("adds categories, blocks duplicates, and tracks the total", async () => {
    renderPage();
    expect(await screen.findByRole("option", { name: "Attack" })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Add category"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Add category" }));
    expect(screen.getByText("1. Attack")).toBeInTheDocument();
    expect(screen.getByText(/Total: 0%/)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Add category"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Add category" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/not already/i);
  });

  it("only enables publishing when the weights total 100", async () => {
    renderPage();
    await screen.findByRole("option", { name: "Attack" });
    await userEvent.selectOptions(screen.getByLabelText("Add category"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Add category" }));
    await userEvent.type(screen.getByLabelText("Weight for Attack"), "100");
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
  });

  it("switches from an existing definition to a new empty definition", async () => {
    mockedApi.assessmentDefinitions.mockResolvedValue(paginated([definition()]));
    renderPage();

    expect(await screen.findByRole("option", { name: /A-Level/ })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Assessment definition"), "new");

    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("Description")).toHaveValue("");
    expect(screen.getByLabelText("Assessment definition")).toHaveValue("new");
  });

  it("uses a text box and creates a custom category when adding one", async () => {
    renderPage();
    await screen.findByRole("option", { name: "Attack" });

    await userEvent.selectOptions(screen.getByLabelText("Category type"), "custom_category");
    expect(screen.getByLabelText("New custom category")).toBeInTheDocument();
    expect(screen.queryByLabelText("Add category")).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("New custom category"), "Communication");
    await userEvent.click(screen.getByRole("button", { name: "Add category" }));

    expect(mockedApi.createCategoryCustom).toHaveBeenCalledWith({ name: "Communication", visibility: "shared" });
    expect(await screen.findByText("1. Communication")).toBeInTheDocument();
  });

  it("rejects an empty custom category name", async () => {
    renderPage();
    await screen.findByRole("option", { name: "Attack" });

    await userEvent.selectOptions(screen.getByLabelText("Category type"), "custom_category");
    await userEvent.click(screen.getByRole("button", { name: "Add category" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a custom category name.");
    expect(mockedApi.createCategoryCustom).not.toHaveBeenCalled();
  });

  it("saves an incomplete definition as a draft", async () => {
    renderPage();
    await screen.findByRole("option", { name: "Attack" });
    await userEvent.type(screen.getByLabelText("Name"), "Screening");
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));

    expect(mockedApi.createAssessmentDefinition).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Screening", status: "draft" }),
    );
  });

  // Guards the regression where the component rendered markup that did not
  // carry the scoped class names, so the constrained layout and button styles
  // silently never applied (buttons looked like plain concatenated text).
  it("renders the styled editor structure the stylesheet targets", async () => {
    mockedApi.assessmentDefinitions.mockResolvedValue(paginated([definition()]));
    const { container } = renderPage();

    expect(await screen.findByRole("option", { name: /A-Level/ })).toBeInTheDocument();

    expect(container.querySelector(".assessment-definitions-page")).not.toBeNull();
    expect(container.querySelector(".assessment-definition-panel")).not.toBeNull();

    expect(screen.getByLabelText("Weight for Attack")).toHaveAttribute("type", "number");

    const publish = screen.getByRole("button", { name: "Publish" });
    expect(publish).toHaveClass("admin-btn-add");
    expect(publish.closest(".assessment-definition-actions")).not.toBeNull();

    expect(screen.getByRole("button", { name: "Save draft" }).closest(".assessment-definition-actions")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Add category" }).closest(".assessment-definition-add")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Up" }).closest(".assessment-definition-row-actions")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Remove" }).closest(".assessment-definition-row-actions")).not.toBeNull();
  });

  // Publishing has to be visibly confirmed: the editor and the button otherwise
  // look identical before and after, so a coach cannot tell it worked.
  it("confirms a publish in words and turns the button into a published state", async () => {
    mockedApi.assessmentDefinitions.mockResolvedValue(paginated([definition()]));
    mockedApi.updateAssessmentDefinition.mockResolvedValue(
      definition({ status: "active" }),
    );
    renderPage();
    await screen.findByRole("option", { name: /A-Level/ });

    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Publish" }));

    // Stated in words...
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent(/A-Level.* now published/i);
    // ...and the button itself says so, filled, and no longer invites a re-publish.
    const published = screen.getByRole("button", { name: /Published/i });
    expect(published).toBeDisabled();
    expect(published).toHaveClass("admin-btn-success");
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("says 'saved as a draft' instead of claiming a draft was published", async () => {
    mockedApi.assessmentDefinitions.mockResolvedValue(paginated([definition()]));
    mockedApi.updateAssessmentDefinition.mockResolvedValue(definition());
    renderPage();
    await screen.findByRole("option", { name: /A-Level/ });

    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/saved as a draft/i);
    expect(screen.queryByRole("button", { name: /Published/i })).not.toBeInTheDocument();
  });

  it("clears the confirmation when another definition is selected", async () => {
    // Otherwise the message keeps claiming the previous definition was published.
    mockedApi.assessmentDefinitions.mockResolvedValue(
      paginated([definition({ id: 10 }), definition({ id: 20, name: "B-Level" })]),
    );
    mockedApi.updateAssessmentDefinition.mockResolvedValue(definition({ status: "active" }));
    renderPage();
    await screen.findByRole("option", { name: /A-Level/ });

    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    await screen.findByRole("status");

    await userEvent.selectOptions(
      screen.getByLabelText("Assessment definition"),
      "20",
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("hides the confirmation when the save fails, so it cannot contradict the error", async () => {
    mockedApi.assessmentDefinitions.mockResolvedValue(paginated([definition()]));
    mockedApi.updateAssessmentDefinition.mockRejectedValue(
      new Error("This assessment definition is in use; duplicate it to make changes."),
    );
    renderPage();
    await screen.findByRole("option", { name: /A-Level/ });

    await userEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/in use/i);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  // Retirement: archiving is reversible, deleting is not, and both are admin-only.
  describe("retirement", () => {
    const unused = () => definition({ deletable: true, in_use: false, archivable: true });
    const inUse = () =>
      definition({
        deletable: false,
        in_use: true,
        archivable: true,
        usage_counts: { assessments: 0, assessment_sessions: 1, ranking_consolidations: 0 },
        usage_summary: "1 assessment session(s)",
      });

    it("hides both controls from a non-admin", async () => {
      mockedApi.assessmentDefinitions.mockResolvedValue(paginated([unused()]));
      renderPage();

      expect(await screen.findByRole("option", { name: /A-Level/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Delete permanently" }),
      ).not.toBeInTheDocument();
    });

    it("offers an admin both actions on an unused definition", async () => {
      mockedApi.assessmentDefinitions.mockResolvedValue(paginated([unused()]));
      renderPage(authValue({ user: adminUser }));

      expect(await screen.findByRole("button", { name: "Archive" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Delete permanently" }),
      ).toBeInTheDocument();
    });

    it("archives without deleting, and keeps the definition in the list", async () => {
      mockedApi.assessmentDefinitions.mockResolvedValue(paginated([unused()]));
      mockedApi.archiveAssessmentDefinition.mockResolvedValue(
        definition({ status: "archived", archivable: false, restorable: true }),
      );
      renderPage(authValue({ user: adminUser }));
      await screen.findByRole("button", { name: "Archive" });

      await userEvent.click(screen.getByRole("button", { name: "Archive" }));

      expect(mockedApi.archiveAssessmentDefinition).toHaveBeenCalledWith(10);
      // A soft delete, not a removal.
      expect(mockedApi.deleteAssessmentDefinition).not.toHaveBeenCalled();
      expect(await screen.findByRole("button", { name: /Restore to draft/i })).toBeInTheDocument();
    });

    it("restores an archived definition", async () => {
      mockedApi.assessmentDefinitions.mockResolvedValue(
        paginated([definition({ status: "archived", archivable: false, restorable: true })]),
      );
      mockedApi.restoreAssessmentDefinition.mockResolvedValue(definition({ status: "draft" }));
      renderPage(authValue({ user: adminUser }));

      await userEvent.click(
        await screen.findByRole("button", { name: /Restore to draft/i }),
      );

      expect(mockedApi.restoreAssessmentDefinition).toHaveBeenCalledWith(10);
    });

    it("confirms before a hard delete, naming what is destroyed", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
      mockedApi.assessmentDefinitions.mockResolvedValue(paginated([unused()]));
      renderPage(authValue({ user: adminUser }));

      await userEvent.click(
        await screen.findByRole("button", { name: "Delete permanently" }),
      );

      // Irreversible, so it says what goes and points at the reversible option.
      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("A-Level"));
      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("cannot be undone"));
      // Declined, so nothing was called.
      expect(mockedApi.deleteAssessmentDefinition).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it("deletes when confirmed and drops it from the list", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      mockedApi.assessmentDefinitions.mockResolvedValue(paginated([unused()]));
      mockedApi.deleteAssessmentDefinition.mockResolvedValue({ message: "Deleted", id: 10 });
      renderPage(authValue({ user: adminUser }));

      await userEvent.click(
        await screen.findByRole("button", { name: "Delete permanently" }),
      );

      expect(mockedApi.deleteAssessmentDefinition).toHaveBeenCalledWith(10);
      expect(
        await screen.findByRole("option", { name: "New definition" }),
      ).toBeInTheDocument();
      confirmSpy.mockRestore();
    });

    it("explains a refused delete instead of offering a dead button", async () => {
      mockedApi.assessmentDefinitions.mockResolvedValue(paginated([inUse()]));
      renderPage(authValue({ user: adminUser }));

      // The blocker is named, and archiving is still offered — it costs nothing.
      expect(
        await screen.findByText(/cannot be deleted because it is in use by 1 assessment session/i),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Delete permanently" }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    });

    it("surfaces a refusal from the server", async () => {
      mockedApi.assessmentDefinitions.mockResolvedValue(paginated([unused()]));
      mockedApi.deleteAssessmentDefinition.mockRejectedValue(
        new Error("This assessment definition is in use by 2 assessment(s), so it cannot be deleted. Archive it instead."),
      );
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      renderPage(authValue({ user: adminUser }));

      await userEvent.click(
        await screen.findByRole("button", { name: "Delete permanently" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(/in use by 2 assessment/i);
      confirmSpy.mockRestore();
    });
  });
});
