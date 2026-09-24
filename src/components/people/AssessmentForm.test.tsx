import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Assessment, type Category, type Coach, type User } from "../../api";
import AssessmentForm from "./AssessmentForm";
import AssessmentList from "./AssessmentList";
import ScoreBadge from "./ScoreBadge";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return { ...actual, api: { ...actual.api, createAssessment: vi.fn(), categories: vi.fn() } };
});
const mockedApi = vi.mocked(api, true);

const coachUser: User = { id: 4, name: "Curator", email_address: "c@x.com", roles: ["curator"], coach_profile_id: null, player_profile_id: null };

const row = (overrides: Partial<Assessment> = {}): Assessment => ({
  id: 1,
  player_profile_id: 12,
  coach_profile_id: 7,
  category_id: 5,
  custom_category: null,
  training_session_id: null,
  score: 70,
  reported_value: 4,
  scale: "one_to_five",
  notes: null,
  status: "active",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  category_label: "Attack",
  ten_scale: 7,
  five_scale: 4,
  score_label: "70/100",
  status_label: "Published",
  created_by: { id: 2, name: "Coach Ana" },
  category: { id: 5, name: "Attack", slug: "attack" },
  ...overrides,
});

const category: Category = { id: 5, name: "Attack", slug: "attack" };
const coach: Coach = {
  id: 7, person_id: 70, coaching_level: null, qualifications: null, status: "active",
  visibility: "shared", created_by: null, created_at: "", updated_at: "",
  full_name: "Olga Reyes", account_status: "profile_only", coach_profile_id: 7,
  person: { id: 70, first_name: "Olga", last_name: "Reyes", email: null, phone: null, date_of_birth: null, creation_source: "coach_created" },
};

describe("ScoreBadge", () => {
  it("renders the canonical score on both scales", () => {
    render(<ScoreBadge score={70} />);
    expect(screen.getByText("70/100 · 7/10 · 4/5")).toBeInTheDocument();
  });

  it("keeps an unrated draft unrated", () => {
    render(<ScoreBadge score={null} />);
    expect(screen.getByText("Not rated yet")).toBeInTheDocument();
  });
});

describe("AssessmentList", () => {
  it("shows the latest row per rubric with status and recorder", () => {
    render(
      <AssessmentList
        assessments={[
          row(),
          row({ id: 2, category_id: null, category: null, category_label: "Serve consistency", custom_category: "Serve consistency", score: 40, status: "draft", score_label: "40/100", ten_scale: 4, five_scale: 3, status_label: "Draft" }),
          row({ id: 3 }),
        ]}
      />,
    );
    expect(screen.getAllByText("Attack").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Serve consistency").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Published").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Recorded by Coach Ana").length).toBeGreaterThan(0);
    expect(screen.getByText(/Assessment history \(3\)/)).toBeInTheDocument();
  });
});

describe("AssessmentForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.createAssessment.mockResolvedValue(row());
  });

  it("previews the canonical conversion live (4/5 → 70/100)", async () => {
    render(<AssessmentForm playerProfileId={12} user={coachUser} categories={[category]} coaches={[coach]} onSaved={() => {}} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("radio", { name: "Existing category" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Scale" }), "one_to_five");
    await userEvent.type(screen.getByRole("spinbutton", { name: "Value" }), "4");
    expect(await screen.findByText("70/100 · 7/10 · 4/5")).toBeInTheDocument();
  });

  it("submits the typed value and scale — never a client-derived score", async () => {
    const onSaved = vi.fn();
    render(<AssessmentForm playerProfileId={12} user={coachUser} categories={[category]} coaches={[coach]} onSaved={onSaved} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("radio", { name: "Existing category" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Category" }), "5");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Scale" }), "one_to_five");
    await userEvent.type(screen.getByRole("spinbutton", { name: "Value" }), "4");
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(mockedApi.createAssessment).toHaveBeenCalledWith(
      expect.objectContaining({ player_profile_id: 12, category_id: 5, value: 4, scale: "one_to_five", status: "active" }),
    );
    expect(onSaved).toHaveBeenCalledWith(row());
  });

  it("offers the attributed-coach picker to oversight only, flagging accountless coaches", () => {
    render(<AssessmentForm playerProfileId={12} user={coachUser} categories={[category]} coaches={[coach]} onSaved={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("combobox", { name: "Attributed coach" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Olga Reyes (profile only)" })).toBeInTheDocument();
  });

  it("loads the category catalogue when the page supplies none", async () => {
    mockedApi.categories.mockResolvedValue([category]);
    render(<AssessmentForm playerProfileId={12} user={coachUser} onSaved={() => {}} onCancel={() => {}} />);

    await userEvent.click(screen.getByRole("radio", { name: "Existing category" }));

    expect(mockedApi.categories).toHaveBeenCalled();
    expect(await screen.findByRole("option", { name: "Attack" })).toBeInTheDocument();
  });

  it("submits a custom category as free text, with no category id", async () => {
    render(<AssessmentForm playerProfileId={12} user={coachUser} categories={[category]} onSaved={() => {}} onCancel={() => {}} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Custom category" }), "Serve placement");
    await userEvent.type(screen.getByRole("spinbutton", { name: "Value" }), "3");
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(mockedApi.createAssessment).toHaveBeenCalledWith(
      expect.objectContaining({ custom_category: "Serve placement", category_id: null }),
    );
  });

  it("renders API validation errors under the fields", async () => {
    mockedApi.createAssessment.mockRejectedValue(
      Object.assign(new Error("Value is not a value on the one_to_five scale"), { name: "ApiValidationError", errors: ["Value is not a value on the one_to_five scale"] }),
    );
    render(<AssessmentForm playerProfileId={12} user={coachUser} categories={[category]} coaches={[coach]} onSaved={() => {}} onCancel={() => {}} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Custom category" }), "Serve consistency");
    await userEvent.type(screen.getByRole("spinbutton", { name: "Value" }), "4");
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/one_to_five scale/);
  });
});
