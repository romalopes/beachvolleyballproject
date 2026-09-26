import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Assessment } from "../../api";
import AssessmentList from "./AssessmentList";
import ScoreBadge from "./ScoreBadge";

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

  it("is read-only — renders no edit control", () => {
    render(<AssessmentList assessments={[row()]} />);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });
});
