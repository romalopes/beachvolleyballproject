import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type AssessmentDefinition, type Category, type CategoryCustom } from "../api";
import { paginated } from "../test/paginated";
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
    render(<AssessmentDefinitions />);
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
    render(<AssessmentDefinitions />);
    await screen.findByRole("option", { name: "Attack" });
    await userEvent.selectOptions(screen.getByLabelText("Add category"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Add category" }));
    await userEvent.type(screen.getByLabelText("Weight for Attack"), "100");
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
  });

  it("switches from an existing definition to a new empty definition", async () => {
    mockedApi.assessmentDefinitions.mockResolvedValue(paginated([definition()]));
    render(<AssessmentDefinitions />);

    expect(await screen.findByRole("option", { name: /A-Level/ })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Assessment definition"), "new");

    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("Description")).toHaveValue("");
    expect(screen.getByLabelText("Assessment definition")).toHaveValue("new");
  });

  it("uses a text box and creates a custom category when adding one", async () => {
    render(<AssessmentDefinitions />);
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
    render(<AssessmentDefinitions />);
    await screen.findByRole("option", { name: "Attack" });

    await userEvent.selectOptions(screen.getByLabelText("Category type"), "custom_category");
    await userEvent.click(screen.getByRole("button", { name: "Add category" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a custom category name.");
    expect(mockedApi.createCategoryCustom).not.toHaveBeenCalled();
  });

  it("saves an incomplete definition as a draft", async () => {
    render(<AssessmentDefinitions />);
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
    const { container } = render(<AssessmentDefinitions />);

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
});
